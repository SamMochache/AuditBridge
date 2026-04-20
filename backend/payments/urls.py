"""
payments/urls.py

Added: /<pk>/suggestions/ — returns fuzzy student matches for a failed payment.
"""

from django.urls import path

from .views import (
    AuditTrailView,
    ClassBalancesView,
    CollectionTrendsView,
    DashboardStatsView,
    PaymentDetailView,
    PaymentListView,
    PaymentSuggestionsView,
    ReconcilePaymentsView,
    RetryReconcilePaymentView,
    StudentDetailView,
    StudentFeesView,
    StudentListView,
    TermStatsView,
    UnmatchedPaymentsView,
    UploadMpesaCSV,
)

app_name = "payments"

urlpatterns = [
    # ── Payment management ─────────────────────────────────────────────────────
    path("upload/", UploadMpesaCSV.as_view(), name="upload-csv"),
    path("list/", PaymentListView.as_view(), name="payment-list"),
    path("<int:pk>/", PaymentDetailView.as_view(), name="payment-detail"),
    path("reconcile/", ReconcilePaymentsView.as_view(), name="reconcile"),
    path("<int:pk>/retry/", RetryReconcilePaymentView.as_view(), name="retry-reconcile"),
    path("<int:pk>/suggestions/", PaymentSuggestionsView.as_view(), name="payment-suggestions"),
    path("unmatched/", UnmatchedPaymentsView.as_view(), name="unmatched"),
    # ── Student management ─────────────────────────────────────────────────────
    path("students/", StudentListView.as_view(), name="student-list"),
    path("students/<int:pk>/", StudentDetailView.as_view(), name="student-detail"),
    path("students/<int:pk>/fees/", StudentFeesView.as_view(), name="student-fees"),
    # ── Dashboard & Reports ────────────────────────────────────────────────────
    path("dashboard/stats/", DashboardStatsView.as_view(), name="dashboard-stats"),
    path("dashboard/trends/", CollectionTrendsView.as_view(), name="collection-trends"),
    path("dashboard/class-balances/", ClassBalancesView.as_view(), name="class-balances"),
    path("dashboard/term-stats/", TermStatsView.as_view(), name="term-stats"),
    path("audit-trail/", AuditTrailView.as_view(), name="audit-trail"),
]
