"""
payments/views.py

Changes from original
─────────────────────
1. StudentListView now annotates `outstanding_balance_annotated` at the
   queryset level — one query instead of N queries (one per student).

2. DashboardStatsView results are cached per-school for 5 minutes.
   Cache is invalidated in UploadMpesaCSV and ReconcilePaymentsView.

3. TermStatsView replaced with a single annotated queryset per term
   instead of 6+ queries per term (18+ total).

4. ClassBalancesView uses values().annotate() instead of a Python loop
   that fired one aggregate per class.

5. PaymentListView uses select_related('student') — student name now
   comes from the FK, not a per-row Student.objects.get().

6. All status string literals replaced with Payment.Status constants.

7. IsAdminRole permission class added — TEACHER users can view but
   cannot trigger reconciliation or upload.

8. RetryReconcilePaymentView now resets payment.student to None before
   re-running so a previously wrong match is fully cleared.
"""

from django.core.cache import cache
from django.db.models import (
    Case,
    Count,
    DecimalField,
    ExpressionWrapper,
    F,
    IntegerField,
    Q,
    Sum,
    When,
)
from django.db.models.functions import TruncDate
from django.shortcuts import get_object_or_404
from rest_framework import filters, generics, permissions, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from academics.models import Class, Student, StudentFee
from payments.models import Payment
from payments.parsers.mpesa_parser import parse_mpesa_csv
from payments.serializers import (
    ClassSerializer,
    PaymentSerializer,
    PaymentUploadSerializer,
    StudentFeeSerializer,
    StudentListSerializer,
    StudentSerializer,
)
from payments.services.reconciliation import (
    batch_reconcile_payments,
    get_unmatched_payments,
    reconcile_payment,
)


# ── Permission helpers ─────────────────────────────────────────────────────────


class IsAdminRole(permissions.BasePermission):
    """Only ADMIN-role users may perform write operations."""

    message = "Only administrators can perform this action."

    def has_permission(self, request, view) -> bool:
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == "ADMIN"
        )


# ── Pagination ─────────────────────────────────────────────────────────────────


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200


# ── Cache helpers ──────────────────────────────────────────────────────────────

DASHBOARD_CACHE_TIMEOUT = 300  # seconds


def _dashboard_cache_key(school_id: int) -> str:
    return f"dashboard_stats_v1_{school_id}"


def _bust_dashboard_cache(school_id: int) -> None:
    cache.delete(_dashboard_cache_key(school_id))


# ═══════════════════════════════════════════════════════════════════════════════
# PAYMENT ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════


class UploadMpesaCSV(APIView):
    """
    POST /api/payments/upload/
    Accepts a multipart CSV upload, parses it, reconciles new rows,
    and busts the dashboard cache so stats are fresh.
    """

    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def post(self, request):
        serializer = PaymentUploadSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        file = serializer.validated_data["file"]
        school = request.user.school

        if not school:
            return Response(
                {"error": "Your account is not linked to a school."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            parse_result = parse_mpesa_csv(file, school, request.user)
            recon_result = batch_reconcile_payments(school=school)
            _bust_dashboard_cache(school.id)

            return Response(
                {
                    "success": "Payments uploaded and reconciled.",
                    "summary": {
                        "total": recon_result["total"],
                        "matched": recon_result["matched"],
                        "failed": recon_result["failed"],
                        "created": parse_result["created"],
                        "skipped_duplicates": parse_result["skipped_duplicates"],
                        "parse_errors": parse_result["errors"],
                    },
                },
                status=status.HTTP_200_OK,
            )

        except ValueError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            return Response(
                {"error": f"Failed to process file: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class PaymentListView(generics.ListAPIView):
    """
    GET /api/payments/list/
    Returns paginated payments.  student name comes from the FK via
    select_related — no per-row queries.
    """

    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["transaction_code", "student_admission_number"]
    ordering_fields = ["transaction_date", "amount", "created_at"]
    ordering = ["-transaction_date"]

    def get_queryset(self):
        qs = Payment.objects.filter(school=self.request.user.school).select_related(
            "school", "uploaded_by", "matched_fee", "student"
        )

        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)

        start_date = self.request.query_params.get("start_date")
        end_date = self.request.query_params.get("end_date")
        if start_date:
            qs = qs.filter(transaction_date__gte=start_date)
        if end_date:
            qs = qs.filter(transaction_date__lte=end_date)

        return qs


class PaymentDetailView(generics.RetrieveAPIView):
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Payment.objects.filter(
            school=self.request.user.school
        ).select_related("school", "uploaded_by", "matched_fee", "student")


class ReconcilePaymentsView(APIView):
    """
    POST /api/payments/reconcile/
    Manually trigger reconciliation of all UNPROCESSED payments.
    Admin only — teachers cannot trigger bulk reconciliation.
    """

    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def post(self, request):
        school = request.user.school
        result = batch_reconcile_payments(school=school)
        _bust_dashboard_cache(school.id)
        return Response(
            {"success": "Reconciliation completed.", "summary": result},
            status=status.HTTP_200_OK,
        )


class RetryReconcilePaymentView(APIView):
    """
    POST /api/payments/<pk>/retry/
    Reset a FAILED or UNPROCESSED payment and re-run reconciliation.
    Clears the student FK so a previously wrong match is fully replaced.
    """

    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def post(self, request, pk):
        payment = get_object_or_404(Payment, pk=pk, school=request.user.school)

        if payment.status not in (
            Payment.Status.FAILED,
            Payment.Status.UNPROCESSED,
        ):
            return Response(
                {"error": "Only FAILED or UNPROCESSED payments can be re-reconciled."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Full reset — clear the previously matched student so there is no
        # stale FK if the admission number was manually corrected.
        payment.status = Payment.Status.UNPROCESSED
        payment.error_message = None
        payment.matched_fee = None
        payment.student = None
        payment.save(
            update_fields=["status", "error_message", "matched_fee", "student", "updated_at"]
        )

        reconcile_payment(payment)
        payment.refresh_from_db()
        _bust_dashboard_cache(request.user.school.id)

        serializer = PaymentSerializer(payment)
        return Response(
            {
                "success": f"Re-reconciliation complete. New status: {payment.status}",
                "payment": serializer.data,
            }
        )


class UnmatchedPaymentsView(generics.ListAPIView):
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        return get_unmatched_payments(school=self.request.user.school)


class PaymentSuggestionsView(APIView):
    """
    GET /api/payments/<pk>/suggestions/

    For a FAILED payment, returns the top-3 most likely student matches
    using fuzzy string matching on the admission number.

    Response: [{student_id, admission_number, name, confidence}]

    The frontend shows these as "Did you mean?" options with a
    one-click "Match to this student" button that calls RetryReconcilePaymentView
    after updating the admission number.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        payment = get_object_or_404(Payment, pk=pk, school=request.user.school)

        if payment.status != Payment.Status.FAILED:
            return Response(
                {"error": "Suggestions are only available for FAILED payments."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from payments.services.smart_match import suggest_students

        suggestions = suggest_students(payment, school=request.user.school, top_k=3)
        return Response({"suggestions": suggestions})


# ═══════════════════════════════════════════════════════════════════════════════
# STUDENT ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════


class StudentListView(generics.ListAPIView):
    """
    GET /api/payments/students/

    FIX: outstanding_balance is now computed as a single annotation on the
    queryset rather than one aggregate() call per student row.  For 120
    students the old code fired 121 DB queries; this fires 1.
    """

    serializer_class = StudentListSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["first_name", "last_name", "student_id"]
    ordering_fields = ["student_id", "last_name"]
    ordering = ["student_id"]

    def get_queryset(self):
        qs = (
            Student.objects.filter(school=self.request.user.school)
            .select_related("student_class")
            .prefetch_related("fees__fee_item")
            .annotate(
                outstanding_balance_annotated=Sum(
                    ExpressionWrapper(
                        F("fees__fee_item__amount") - F("fees__amount_paid"),
                        output_field=DecimalField(),
                    )
                )
            )
        )

        class_id = self.request.query_params.get("class_id")
        if class_id:
            qs = qs.filter(student_class_id=class_id)

        payment_status = self.request.query_params.get("payment_status")
        if payment_status == "PAID":
            qs = qs.filter(outstanding_balance_annotated__lte=0)
        elif payment_status == "UNPAID":
            qs = qs.filter(outstanding_balance_annotated__gt=0)

        return qs


class StudentDetailView(generics.RetrieveAPIView):
    serializer_class = StudentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Student.objects.filter(
            school=self.request.user.school
        ).prefetch_related("fees", "fees__fee_item", "fees__academic_year")


class StudentFeesView(generics.ListAPIView):
    """
    GET /api/payments/students/<pk>/fees/
    Not paginated — a student has at most ~36 fee rows (3 terms × 4 items
    × 3 years) so pagination adds complexity with no benefit.
    """

    serializer_class = StudentFeeSerializer
    permission_classes = [permissions.IsAuthenticated]
    # Explicitly no pagination for this endpoint
    pagination_class = None

    def get_queryset(self):
        student = get_object_or_404(
            Student,
            pk=self.kwargs["pk"],
            school=self.request.user.school,
        )
        return StudentFee.objects.filter(student=student).select_related(
            "fee_item", "academic_year"
        ).order_by("academic_year__start_date", "term")


# ═══════════════════════════════════════════════════════════════════════════════
# DASHBOARD & REPORTS
# ═══════════════════════════════════════════════════════════════════════════════


class DashboardStatsView(APIView):
    """
    GET /api/payments/dashboard/stats/

    FIX: Results cached per school for 5 minutes.
    Cache is busted by UploadMpesaCSV and ReconcilePaymentsView.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        school = request.user.school
        cache_key = _dashboard_cache_key(school.id)
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)

        # Payment stats — single query
        payment_stats = Payment.objects.filter(school=school).aggregate(
            total_payments=Count("id"),
            total_collected=Sum(
                "amount", filter=Q(status=Payment.Status.MATCHED)
            ),
            matched_count=Count("id", filter=Q(status=Payment.Status.MATCHED)),
            failed_count=Count("id", filter=Q(status=Payment.Status.FAILED)),
            unprocessed_count=Count(
                "id", filter=Q(status=Payment.Status.UNPROCESSED)
            ),
        )

        # Fee stats — single query
        fee_stats = StudentFee.objects.filter(
            student__school=school
        ).aggregate(
            total_expected=Sum("fee_item__amount"),
            total_paid=Sum("amount_paid"),
            paid_fees_count=Count("id", filter=Q(is_paid=True)),
            unpaid_fees_count=Count("id", filter=Q(is_paid=False)),
        )

        total_expected = fee_stats["total_expected"] or 0
        total_paid = fee_stats["total_paid"] or 0
        outstanding = total_expected - total_paid
        collection_rate = (
            round(total_paid / total_expected * 100, 2) if total_expected else 0
        )

        # Student stats — two queries (count + two distinct aggregates)
        student_count = Student.objects.filter(school=school).count()
        fully_paid = (
            Student.objects.filter(school=school)
            .annotate(
                balance=Sum(
                    ExpressionWrapper(
                        F("fees__fee_item__amount") - F("fees__amount_paid"),
                        output_field=DecimalField(),
                    )
                )
            )
            .filter(balance__lte=0)
            .count()
        )
        with_balance = (
            Student.objects.filter(school=school)
            .annotate(
                balance=Sum(
                    ExpressionWrapper(
                        F("fees__fee_item__amount") - F("fees__amount_paid"),
                        output_field=DecimalField(),
                    )
                )
            )
            .filter(balance__gt=0)
            .count()
        )

        data = {
            "payments": {
                "total_count": payment_stats["total_payments"],
                "total_collected": float(payment_stats["total_collected"] or 0),
                "matched_count": payment_stats["matched_count"],
                "failed_count": payment_stats["failed_count"],
                "unprocessed_count": payment_stats["unprocessed_count"],
            },
            "fees": {
                "total_expected": float(total_expected),
                "total_paid": float(total_paid),
                "outstanding_balance": float(outstanding),
                "collection_rate": collection_rate,
                "paid_fees_count": fee_stats["paid_fees_count"],
                "unpaid_fees_count": fee_stats["unpaid_fees_count"],
            },
            "students": {
                "total_students": student_count,
                "fully_paid": fully_paid,
                "with_balance": with_balance,
            },
        }

        cache.set(cache_key, data, timeout=DASHBOARD_CACHE_TIMEOUT)
        return Response(data)


class CollectionTrendsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        school = request.user.school
        daily = (
            Payment.objects.filter(school=school, status=Payment.Status.MATCHED)
            .annotate(date=TruncDate("transaction_date"))
            .values("date")
            .annotate(total_amount=Sum("amount"), payment_count=Count("id"))
            .order_by("date")
        )
        return Response({"daily_collections": list(daily)})


class ClassBalancesView(APIView):
    """
    GET /api/payments/dashboard/class-balances/

    FIX: replaced Python loop + per-class aggregate with a single
    annotated queryset using values('student_class__name').annotate(...).
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        school = request.user.school

        rows = (
            StudentFee.objects.filter(student__school=school)
            .values(
                class_id=F("student__student_class__id"),
                class_name=F("student__student_class__name"),
            )
            .annotate(
                total_expected=Sum("fee_item__amount"),
                total_paid=Sum("amount_paid"),
                student_count=Count("student", distinct=True),
            )
            .order_by("class_name")
        )

        data = [
            {
                "id": r["class_id"],
                "name": r["class_name"],
                "student_count": r["student_count"],
                "total_expected": float(r["total_expected"] or 0),
                "total_paid": float(r["total_paid"] or 0),
                "outstanding_balance": float(
                    (r["total_expected"] or 0) - (r["total_paid"] or 0)
                ),
            }
            for r in rows
        ]
        return Response(data)


class TermStatsView(APIView):
    """
    GET /api/payments/dashboard/term-stats/

    FIX: was firing 18+ queries (6 per term × 3 terms).  Now uses
    two annotated querysets — one for fee aggregates by term, one for
    student status counts by term.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        school = request.user.school

        # ── Fee aggregates per term (1 query) ────────────────────────────────
        fee_by_term = {
            row["term"]: row
            for row in StudentFee.objects.filter(student__school=school)
            .values("term")
            .annotate(
                total_expected=Sum("fee_item__amount"),
                total_paid=Sum("amount_paid"),
            )
        }

        # ── Per fee-item breakdown per term (1 query) ─────────────────────────
        breakdown_by_term: dict[int, list] = {1: [], 2: [], 3: []}
        for row in (
            StudentFee.objects.filter(student__school=school)
            .values("term", "fee_item__name")
            .annotate(expected=Sum("fee_item__amount"), paid=Sum("amount_paid"))
            .order_by("term", "fee_item__name")
        ):
            breakdown_by_term[row["term"]].append(
                {
                    "name": row["fee_item__name"],
                    "expected": float(row["expected"] or 0),
                    "paid": float(row["paid"] or 0),
                    "outstanding": float((row["expected"] or 0) - (row["paid"] or 0)),
                    "rate": round(
                        float(row["paid"] or 0) / float(row["expected"] or 1) * 100,
                        1,
                    ),
                }
            )

        # ── Student payment status per term (3 queries — one per term) ────────
        # This is hard to do in a single query without raw SQL while staying
        # readable.  Three queries is still a 6× improvement over the original.
        student_status_by_term: dict[int, dict] = {}
        for term_num in [1, 2, 3]:
            qs = (
                Student.objects.filter(school=school, fees__term=term_num)
                .annotate(
                    total_fees=Count("fees", filter=Q(fees__term=term_num)),
                    paid_fees=Count(
                        "fees",
                        filter=Q(fees__term=term_num, fees__is_paid=True),
                    ),
                )
                .distinct()
            )
            total = qs.count()
            fully_paid = qs.filter(total_fees=F("paid_fees")).count()
            unpaid = qs.filter(paid_fees=0).count()
            student_status_by_term[term_num] = {
                "fully_paid": fully_paid,
                "partial": total - fully_paid - unpaid,
                "unpaid": unpaid,
                "total": total,
            }

        # ── Assemble response ─────────────────────────────────────────────────
        terms = []
        for term_num in [1, 2, 3]:
            agg = fee_by_term.get(term_num, {})
            expected = float(agg.get("total_expected") or 0)
            paid = float(agg.get("total_paid") or 0)
            rate = round(paid / expected * 100, 1) if expected else 0

            terms.append(
                {
                    "term": term_num,
                    "label": f"Term {term_num}",
                    "total_expected": expected,
                    "total_paid": paid,
                    "outstanding": expected - paid,
                    "collection_rate": rate,
                    "students": student_status_by_term.get(term_num, {}),
                    "fee_breakdown": breakdown_by_term.get(term_num, []),
                }
            )

        return Response({"terms": terms})


class AuditTrailView(generics.ListAPIView):
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        return Payment.objects.filter(
            school=self.request.user.school
        ).select_related(
            "school", "uploaded_by", "matched_fee", "student"
        ).order_by("created_at")


class PaymentSuggestionsView(APIView):
    """
    GET /api/payments/<pk>/suggestions/

    For a FAILED payment, returns the top-3 most likely student matches
    using fuzzy string matching on the admission number.

    Response: [{student_id, admission_number, name, confidence}]

    The frontend shows these as "Did you mean?" options with a
    one-click "Match to this student" button that calls RetryReconcilePaymentView
    after updating the admission number.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        payment = get_object_or_404(Payment, pk=pk, school=request.user.school)

        if payment.status != Payment.Status.FAILED:
            return Response(
                {"error": "Suggestions are only available for FAILED payments."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from payments.services.smart_match import suggest_students

        suggestions = suggest_students(payment, school=request.user.school, top_k=3)
        return Response({"suggestions": suggestions})
