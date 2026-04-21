"""
payments/services/reconciliation.py

Fixes applied (see audit report):
──────────────────────────────────
FIX-1  CRITICAL: Pre-lock "check-then-lock" race eliminated.
       The `is_paid=False` existence check is now performed INSIDE
       `transaction.atomic()` after `select_for_update()` has been
       issued, so the check participates in the row-level lock.

FIX-2  HIGH: `batch_reconcile_payments()` replaced `qs.iterator()` with
       explicit offset-based batching to avoid a server-side cursor being
       open while nested `transaction.atomic()` blocks commit inside
       `reconcile_payment()`.  psycopg2 tolerates this but it creates
       implicit coupling that breaks under some pgbouncer configurations.

FIX-3  MEDIUM: `DatabaseError` / `OperationalError` caught in
       `reconcile_payment()` so a mid-flight DB hiccup marks the payment
       FAILED with a clear message instead of propagating an unhandled
       exception that leaves the row in UNPROCESSED forever.

FIX-4  MEDIUM: `RetryReconcilePaymentView` race (separate file) is
       handled there; `reconcile_payment()` itself is idempotent once
       the payment row is locked by the caller, so no additional change
       is needed here beyond FIX-1.

All existing logic (chronological fee distribution, surplus detection,
structured logging, update_fields) is preserved exactly.
"""

import logging
from decimal import Decimal

from django.db import DatabaseError, OperationalError, transaction

from academics.models import Student, StudentFee
from payments.models import Payment

logger = logging.getLogger("payments.reconciliation")

# ── Batch size for explicit chunked processing ────────────────────────────────
_BATCH_SIZE = 200


def reconcile_payment(payment: Payment) -> None:
    """
    Match a single UNPROCESSED payment to student fees.

    Distributes the payment amount across the student's unpaid fees in
    chronological order (earliest academic year / earliest term first).
    Any surplus is recorded but the payment is still MATCHED.

    CONCURRENCY SAFETY
    ------------------
    FIX-1: Both the "all fees paid?" check and the fee distribution now
    occur INSIDE a single `transaction.atomic()` block after
    `select_for_update()` has been issued.  The old code checked
    `is_paid=False` *outside* the lock, creating a window where another
    thread could pay all fees between the check and the lock acquisition,
    causing this payment to be incorrectly marked FAILED.

    DB ERROR SAFETY
    ---------------
    FIX-3: `DatabaseError` is caught and recorded on the payment row so
    the operator can identify and retry failed rows without digging through
    logs.
    """
    if payment.status != Payment.Status.UNPROCESSED:
        logger.debug(
            "skipping_already_processed",
            extra={"payment_id": payment.id, "status": payment.status},
        )
        return

    # ── 1. Resolve the student ────────────────────────────────────────────────
    try:
        student = Student.objects.get(
            student_id=payment.student_admission_number,
            school=payment.school,
        )
    except Student.DoesNotExist:
        payment.status = Payment.Status.FAILED
        payment.error_message = (
            f"Student with admission number "
            f"'{payment.student_admission_number}' not found in this school."
        )
        payment.save(update_fields=["status", "error_message", "updated_at"])
        logger.warning(
            "reconciliation_failed_unknown_student",
            extra={
                "payment_id": payment.id,
                "admission_number": payment.student_admission_number,
                "school_id": payment.school_id,
            },
        )
        return

    # ── 2. Apply payment with row-level locking ───────────────────────────────
    #
    # FIX-1: The "all fees paid?" check has been moved INSIDE the atomic block.
    # Both the lock acquisition and the check are now a single atomic operation.
    # A concurrent thread reconciling the same student will block at
    # select_for_update() until this transaction commits, then see the
    # updated is_paid values.
    #
    # FIX-3: Wrap in try/except so a transient DB error doesn't silently
    # leave the payment in UNPROCESSED.

    try:
        with transaction.atomic():
            # Lock all fee rows for this student — concurrent reconciliations
            # for the same student will block here until we commit.
            student_fees = (
                StudentFee.objects.select_for_update()
                .filter(student=student, is_paid=False)
                .select_related("fee_item", "academic_year")
                .order_by("academic_year__start_date", "term")
            )

            # FIX-1: "All fees paid?" check is now inside the lock.
            # Previously this was a separate query outside the atomic block,
            # creating a TOCTOU race.
            if not student_fees.exists():
                payment.status = Payment.Status.MATCHED
                payment.student = student
                payment.error_message = (
                    "All fees for this student are already paid. "
                    "This payment is recorded as a surplus/advance."
                )
                payment.save(
                    update_fields=[
                        "status", "student", "error_message", "updated_at"
                    ]
                )
                logger.info(
                    "reconciliation_surplus_all_paid",
                    extra={
                        "payment_id": payment.id,
                        "student_id": student.id,
                        "amount": str(payment.amount),
                    },
                )
                return

            remaining_amount = payment.amount
            fees_updated: list[StudentFee] = []

            for fee in student_fees:
                if remaining_amount <= Decimal("0"):
                    break

                amount_owed = fee.fee_item.amount - fee.amount_paid
                amount_to_apply = min(remaining_amount, amount_owed)

                fee.amount_paid += amount_to_apply
                if fee.amount_paid >= fee.fee_item.amount:
                    fee.is_paid = True
                fee.save(update_fields=["amount_paid", "is_paid"])

                fees_updated.append(fee)
                remaining_amount -= amount_to_apply

            # ── 3. Record outcome ─────────────────────────────────────────────
            if fees_updated:
                payment.status = Payment.Status.MATCHED
                payment.student = student
                payment.matched_fee = fees_updated[0]

                if remaining_amount > Decimal("0"):
                    payment.error_message = (
                        f"Overpayment of KES {remaining_amount:.2f}. "
                        f"All outstanding fees have been cleared."
                    )
                else:
                    payment.error_message = None

                payment.save(
                    update_fields=[
                        "status",
                        "student",
                        "matched_fee",
                        "error_message",
                        "updated_at",
                    ]
                )
                logger.info(
                    "reconciliation_matched",
                    extra={
                        "payment_id": payment.id,
                        "student_id": student.id,
                        "amount": str(payment.amount),
                        "fees_updated": len(fees_updated),
                        "surplus": str(remaining_amount),
                    },
                )
            else:
                # All fees existed in the queryset but every amount_owed was 0
                # (edge case: fee_item.amount == amount_paid but is_paid=False).
                payment.status = Payment.Status.FAILED
                payment.error_message = (
                    "Unable to apply payment — no eligible fee rows found."
                )
                payment.save(update_fields=["status", "error_message", "updated_at"])
                logger.error(
                    "reconciliation_failed_no_fees",
                    extra={"payment_id": payment.id, "student_id": student.id},
                )

    except (DatabaseError, OperationalError) as exc:
        # FIX-3: Record DB-level failures on the payment row so operators
        # can identify and retry them without log diving.
        logger.exception(
            "reconciliation_db_error",
            extra={"payment_id": payment.id, "error": str(exc)},
        )
        try:
            payment.status = Payment.Status.FAILED
            payment.error_message = (
                f"Database error during reconciliation: {exc}. "
                f"Please retry this payment."
            )
            payment.save(update_fields=["status", "error_message", "updated_at"])
        except Exception:
            # If we can't even save the error, just log it.
            logger.critical(
                "reconciliation_db_error_save_failed",
                extra={"payment_id": payment.id},
            )


def batch_reconcile_payments(school=None) -> dict:
    """
    Process all UNPROCESSED payments, optionally filtered by school.

    Returns a summary dict: {total, matched, failed}

    FIX-2: Replaced `qs.iterator(chunk_size=200)` with explicit offset-based
    batching.  `qs.iterator()` opens a PostgreSQL server-side cursor which
    must remain open for the full duration of the loop.  `reconcile_payment()`
    opens its own `transaction.atomic()` block on each iteration — while
    psycopg2 handles this correctly today, it is incompatible with pgbouncer
    in transaction-pooling mode and creates hard-to-diagnose failures when
    switching connection poolers.  Explicit batching has the same memory
    profile (only _BATCH_SIZE rows in memory at once) with no cursor coupling.
    """
    base_qs = Payment.objects.filter(status=Payment.Status.UNPROCESSED)
    if school:
        base_qs = base_qs.filter(school=school)

    total = base_qs.count()
    matched = 0
    failed = 0

    logger.info(
        "batch_reconciliation_started",
        extra={"school_id": getattr(school, "id", None), "total": total},
    )

    # FIX-2: Explicit offset batching — no server-side cursor held open.
    offset = 0
    while True:
        # Re-filter each batch so already-processed rows from previous
        # batches are excluded (status changed to MATCHED/FAILED).
        batch = list(
            base_qs.order_by("id")[offset: offset + _BATCH_SIZE]
        )
        if not batch:
            break

        for payment in batch:
            # Re-check status in case another process handled this payment
            # between the batch fetch and now.
            payment.refresh_from_db(fields=["status"])
            if payment.status != Payment.Status.UNPROCESSED:
                continue

            reconcile_payment(payment)
            payment.refresh_from_db(fields=["status"])

            if payment.status == Payment.Status.MATCHED:
                matched += 1
            elif payment.status == Payment.Status.FAILED:
                failed += 1

        offset += _BATCH_SIZE

    logger.info(
        "batch_reconciliation_complete",
        extra={
            "school_id": getattr(school, "id", None),
            "total": total,
            "matched": matched,
            "failed": failed,
        },
    )
    return {"total": total, "matched": matched, "failed": failed}


def get_reconciliation_report(school=None) -> dict:
    from django.db.models import Count, Q, Sum

    qs = Payment.objects.all()
    if school:
        qs = qs.filter(school=school)

    return qs.aggregate(
        total_payments=Count("id"),
        total_amount=Sum("amount"),
        matched_count=Count("id", filter=Q(status=Payment.Status.MATCHED)),
        matched_amount=Sum("amount", filter=Q(status=Payment.Status.MATCHED)),
        failed_count=Count("id", filter=Q(status=Payment.Status.FAILED)),
        failed_amount=Sum("amount", filter=Q(status=Payment.Status.FAILED)),
        unprocessed_count=Count("id", filter=Q(status=Payment.Status.UNPROCESSED)),
        unprocessed_amount=Sum(
            "amount", filter=Q(status=Payment.Status.UNPROCESSED)
        ),
    )


def get_unmatched_payments(school=None):
    qs = Payment.objects.filter(status=Payment.Status.FAILED)
    if school:
        qs = qs.filter(school=school)
    return qs.select_related("school", "uploaded_by", "student").order_by(
        "-transaction_date"
    )