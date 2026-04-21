"""
payments/services/reconciliation.py

Key fixes in this revision
──────────────────────────
1. select_for_update() INSIDE transaction.atomic() → eliminates the race
   condition where two concurrent uploads could double-credit the same
   student fee row.
2. payment.student is now set when a student is found, using the new
   ForeignKey added to the Payment model. This removes the per-row
   Student.objects.get() in PaymentSerializer.get_student_name().
3. Structured logging on every reconciliation outcome so production
   issues are diagnosable without adding print statements.
4. All status strings replaced with Payment.Status constants.
"""

import logging
from decimal import Decimal

from django.db import transaction

from academics.models import Student, StudentFee
from payments.models import Payment

logger = logging.getLogger("payments.reconciliation")


def reconcile_payment(payment: Payment) -> None:
    """
    Match a single UNPROCESSED payment to student fees.

    Concurrency-safe:
    - All reads + decisions about StudentFee happen inside transaction.atomic()
    - select_for_update() ensures no double-crediting or stale reads
    """
    if payment.status != Payment.Status.UNPROCESSED:
        logger.debug(
            "skipping_already_processed",
            extra={"payment_id": payment.id, "status": payment.status},
        )
        return

    # ── 1. Resolve student ────────────────────────────────────────────────
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

    # ── 2. Apply payment WITH LOCKING (FIXED) ─────────────────────────────
    remaining_amount = payment.amount
    fees_updated: list[StudentFee] = []

    with transaction.atomic():
        # 🔒 Lock rows FIRST
        student_fees = (
            StudentFee.objects.select_for_update()
            .filter(student=student)
            .select_related("fee_item", "academic_year")
            .order_by("academic_year__start_date", "term")
        )

        # ✅ SAFE existence check (under lock)
        has_outstanding = False
        for fee in student_fees:
            amount_owed = fee.fee_item.amount - fee.amount_paid
            if amount_owed > 0:
                has_outstanding = True
                break

        if not has_outstanding:
            payment.status = Payment.Status.MATCHED
            payment.student = student
            payment.error_message = (
                "All fees for this student are already paid. "
                "This payment is recorded as a surplus/advance."
            )
            payment.save(update_fields=["status", "student", "error_message", "updated_at"])

            logger.info(
                "reconciliation_surplus",
                extra={
                    "payment_id": payment.id,
                    "student_id": student.id,
                    "amount": str(payment.amount),
                },
            )
            return

        # 🔁 Apply payment
        for fee in student_fees:
            if remaining_amount <= Decimal("0"):
                break

            amount_owed = fee.fee_item.amount - fee.amount_paid
            if amount_owed <= Decimal("0"):
                continue

            amount_to_apply = min(remaining_amount, amount_owed)

            fee.amount_paid += amount_to_apply
            if fee.amount_paid >= fee.fee_item.amount:
                fee.is_paid = True

            fee.save(update_fields=["amount_paid", "is_paid"])

            fees_updated.append(fee)
            remaining_amount -= amount_to_apply

        # ── 3. Outcome ────────────────────────────────────────────────────
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
            # Should be extremely rare now
            payment.status = Payment.Status.FAILED
            payment.error_message = "Unable to apply payment — no eligible fee rows found."
            payment.save(update_fields=["status", "error_message", "updated_at"])

            logger.error(
                "reconciliation_failed_no_fees",
                extra={"payment_id": payment.id, "student_id": student.id},
            )


def batch_reconcile_payments(school=None) -> dict:
    """
    Process all UNPROCESSED payments, optionally filtered by school.

    Returns a summary dict: {total, matched, failed}
    """
    qs = Payment.objects.filter(status=Payment.Status.UNPROCESSED)
    if school:
        qs = qs.filter(school=school)

    total = qs.count()
    matched = 0
    failed = 0

    logger.info(
        "batch_reconciliation_started",
        extra={"school_id": getattr(school, "id", None), "total": total},
    )

    for payment in qs.iterator(chunk_size=200):
        reconcile_payment(payment)
        payment.refresh_from_db(fields=["status"])

        if payment.status == Payment.Status.MATCHED:
            matched += 1
        elif payment.status == Payment.Status.FAILED:
            failed += 1

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
        unprocessed_amount=Sum("amount", filter=Q(status=Payment.Status.UNPROCESSED)),
    )


def get_unmatched_payments(school=None):
    qs = Payment.objects.filter(status=Payment.Status.FAILED)
    if school:
        qs = qs.filter(school=school)
    return qs.select_related("school", "uploaded_by", "student").order_by(
        "-transaction_date"
    )
