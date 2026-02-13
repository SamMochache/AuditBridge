from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions, generics, filters
from rest_framework.pagination import PageNumberPagination
from django.db.models import Sum, Count, Q, F
from django.shortcuts import get_object_or_404

from .models import Payment
from .serializers import (
    PaymentSerializer, PaymentUploadSerializer, StudentSerializer,
    StudentListSerializer, StudentFeeSerializer, ClassSerializer
)
from .parsers.mpesa_parser import parse_mpesa_csv
from .services.reconciliation import (
    reconcile_payment, batch_reconcile_payments,
    get_reconciliation_report, get_unmatched_payments
)
from academics.models import Student, StudentFee, Class


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200


# ==================== PAYMENT ENDPOINTS ====================

class UploadMpesaCSV(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = PaymentUploadSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        file = serializer.validated_data['file']
        school = request.user.school
        
        if not school:
            return Response(
                {"error": "User must be associated with a school"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Parse CSV
            parse_mpesa_csv(file, school, request.user)
            
            # Reconcile newly uploaded payments
            result = batch_reconcile_payments(school=school)
            
            return Response({
                "success": "Payments uploaded and reconciled",
                "summary": result
            }, status=status.HTTP_200_OK)
        
        except Exception as e:
            return Response(
                {"error": f"Failed to process file: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class PaymentListView(generics.ListAPIView):
    """List all payments with filtering"""
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['transaction_code', 'student_admission_number']
    ordering_fields = ['transaction_date', 'amount', 'created_at']
    ordering = ['-transaction_date']
    
    def get_queryset(self):
        queryset = Payment.objects.filter(school=self.request.user.school)
        
        # Filter by status
        status_filter = self.request.query_params.get('status', None)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # Filter by date range
        start_date = self.request.query_params.get('start_date', None)
        end_date = self.request.query_params.get('end_date', None)
        if start_date:
            queryset = queryset.filter(transaction_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(transaction_date__lte=end_date)
        
        return queryset.select_related('school', 'uploaded_by', 'matched_fee')


class PaymentDetailView(generics.RetrieveAPIView):
    """Get single payment details"""
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return Payment.objects.filter(school=self.request.user.school)


class ReconcilePaymentsView(APIView):
    """Manually trigger reconciliation"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        school = request.user.school
        result = batch_reconcile_payments(school=school)
        
        return Response({
            "success": "Reconciliation completed",
            "summary": result
        }, status=status.HTTP_200_OK)


class UnmatchedPaymentsView(generics.ListAPIView):
    """Get all failed/unmatched payments"""
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    
    def get_queryset(self):
        return get_unmatched_payments(school=self.request.user.school)


# ==================== STUDENT ENDPOINTS ====================

class StudentListView(generics.ListAPIView):
    """List all students with fee balances"""
    serializer_class = StudentListSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['first_name', 'last_name', 'student_id']
    ordering_fields = ['student_id', 'last_name']
    ordering = ['student_id']
    
    def get_queryset(self):
        queryset = Student.objects.filter(school=self.request.user.school)
        
        # Filter by class
        class_id = self.request.query_params.get('class_id', None)
        if class_id:
            queryset = queryset.filter(student_class_id=class_id)
        
        # Filter by payment status
        payment_status = self.request.query_params.get('payment_status', None)
        if payment_status == 'PAID':
            # Students with no outstanding balance
            queryset = queryset.filter(
                fees__is_paid=True
            ).distinct()
        elif payment_status == 'UNPAID':
            # Students with unpaid fees
            queryset = queryset.filter(
                fees__is_paid=False
            ).distinct()
        
        return queryset.prefetch_related('fees', 'fees__fee_item')


class StudentDetailView(generics.RetrieveAPIView):
    """Get detailed student information with all fees"""
    serializer_class = StudentSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return Student.objects.filter(
            school=self.request.user.school
        ).prefetch_related(
            'fees',
            'fees__fee_item',
            'fees__academic_year'
        )


class StudentFeesView(generics.ListAPIView):
    """Get all fees for a specific student"""
    serializer_class = StudentFeeSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        student_id = self.kwargs.get('pk')
        student = get_object_or_404(
            Student,
            pk=student_id,
            school=self.request.user.school
        )
        return StudentFee.objects.filter(student=student).select_related(
            'fee_item', 'academic_year'
        ).order_by('academic_year__start_date', 'term')


# ==================== DASHBOARD & REPORTS ====================

class DashboardStatsView(APIView):
    """Get overall financial statistics"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        school = request.user.school
        
        # Payment statistics
        payment_stats = Payment.objects.filter(school=school).aggregate(
            total_payments=Count('id'),
            total_collected=Sum('amount', filter=Q(status='MATCHED')),
            matched_count=Count('id', filter=Q(status='MATCHED')),
            failed_count=Count('id', filter=Q(status='FAILED')),
            unprocessed_count=Count('id', filter=Q(status='UNPROCESSED')),
        )
        
        # Fee statistics
        fee_stats = StudentFee.objects.filter(
            student__school=school
        ).aggregate(
            total_expected=Sum('fee_item__amount'),
            total_paid=Sum('amount_paid'),
            paid_fees_count=Count('id', filter=Q(is_paid=True)),
            unpaid_fees_count=Count('id', filter=Q(is_paid=False)),
        )
        
        outstanding_balance = (fee_stats['total_expected'] or 0) - (fee_stats['total_paid'] or 0)
        
        # Student statistics
        student_stats = Student.objects.filter(school=school).aggregate(
            total_students=Count('id')
        )
        
        # Students by payment status
        students_fully_paid = Student.objects.filter(
            school=school,
            fees__is_paid=True
        ).distinct().count()
        
        students_with_balance = Student.objects.filter(
            school=school,
            fees__is_paid=False
        ).distinct().count()
        
        return Response({
            "payments": {
                "total_count": payment_stats['total_payments'],
                "total_collected": float(payment_stats['total_collected'] or 0),
                "matched_count": payment_stats['matched_count'],
                "failed_count": payment_stats['failed_count'],
                "unprocessed_count": payment_stats['unprocessed_count'],
            },
            "fees": {
                "total_expected": float(fee_stats['total_expected'] or 0),
                "total_paid": float(fee_stats['total_paid'] or 0),
                "outstanding_balance": float(outstanding_balance),
                "collection_rate": round(
                    (fee_stats['total_paid'] / fee_stats['total_expected'] * 100)
                    if fee_stats['total_expected'] else 0,
                    2
                ),
                "paid_fees_count": fee_stats['paid_fees_count'],
                "unpaid_fees_count": fee_stats['unpaid_fees_count'],
            },
            "students": {
                "total_students": student_stats['total_students'],
                "fully_paid": students_fully_paid,
                "with_balance": students_with_balance,
            }
        })


class CollectionTrendsView(APIView):
    """Get payment collection trends over time"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        from django.db.models.functions import TruncDate
        
        school = request.user.school
        
        # Group payments by date
        daily_collections = Payment.objects.filter(
            school=school,
            status='MATCHED'
        ).annotate(
            date=TruncDate('transaction_date')
        ).values('date').annotate(
            total_amount=Sum('amount'),
            payment_count=Count('id')
        ).order_by('date')
        
        return Response({
            "daily_collections": list(daily_collections)
        })


class ClassBalancesView(generics.ListAPIView):
    """Get outstanding balances by class"""
    serializer_class = ClassSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return Class.objects.filter(school=self.request.user.school)
    
    def list(self, request, *args, **kwargs):
        classes = self.get_queryset()
        
        class_data = []
        for cls in classes:
            students = cls.students.all()
            
            balance_data = StudentFee.objects.filter(
                student__in=students
            ).aggregate(
                total_expected=Sum('fee_item__amount'),
                total_paid=Sum('amount_paid'),
            )
            
            outstanding = (balance_data['total_expected'] or 0) - (balance_data['total_paid'] or 0)
            
            class_data.append({
                "id": cls.id,
                "name": cls.name,
                "student_count": students.count(),
                "total_expected": float(balance_data['total_expected'] or 0),
                "total_paid": float(balance_data['total_paid'] or 0),
                "outstanding_balance": float(outstanding),
            })
        
        return Response(class_data)


class AuditTrailView(generics.ListAPIView):
    """Immutable payment audit trail"""
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    
    def get_queryset(self):
        # Return all payments in chronological order
        return Payment.objects.filter(
            school=self.request.user.school
        ).select_related(
            'school', 'uploaded_by', 'matched_fee'
        ).order_by('created_at')