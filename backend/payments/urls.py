from django.urls import path
from .views import (
    # Payment endpoints
    UploadMpesaCSV,
    PaymentListView,
    PaymentDetailView,
    ReconcilePaymentsView,
    UnmatchedPaymentsView,
    
    # Student endpoints
    StudentListView,
    StudentDetailView,
    StudentFeesView,
    
    # Dashboard & Reports
    DashboardStatsView,
    CollectionTrendsView,
    ClassBalancesView,
    AuditTrailView,
)

app_name = 'payments'

urlpatterns = [
    # Payment management
    path('upload/', UploadMpesaCSV.as_view(), name='upload-csv'),
    path('list/', PaymentListView.as_view(), name='payment-list'),
    path('<int:pk>/', PaymentDetailView.as_view(), name='payment-detail'),
    path('reconcile/', ReconcilePaymentsView.as_view(), name='reconcile'),
    path('unmatched/', UnmatchedPaymentsView.as_view(), name='unmatched'),
    
    # Student management
    path('students/', StudentListView.as_view(), name='student-list'),
    path('students/<int:pk>/', StudentDetailView.as_view(), name='student-detail'),
    path('students/<int:pk>/fees/', StudentFeesView.as_view(), name='student-fees'),
    
    # Dashboard & Reports
    path('dashboard/stats/', DashboardStatsView.as_view(), name='dashboard-stats'),
    path('dashboard/trends/', CollectionTrendsView.as_view(), name='collection-trends'),
    path('dashboard/class-balances/', ClassBalancesView.as_view(), name='class-balances'),
    path('audit-trail/', AuditTrailView.as_view(), name='audit-trail'),
]