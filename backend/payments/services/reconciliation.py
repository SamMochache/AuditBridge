from decimal import Decimal
from django.db import transaction
from payments.models import Payment
from academics.models import StudentFee, Student


def reconcile_payment(payment: Payment):
    """
    Match a payment to student fees with overflow handling.
    Applies payment across multiple fees if amount exceeds single fee.
    """
    from django.db.models import F
    
    # Already processed? Skip
    if payment.status != 'UNPROCESSED':
        return
    
    # Find student first
    try:
        student = Student.objects.get(
            student_id=payment.student_admission_number,
            school=payment.school
        )
    except Student.DoesNotExist:
        payment.status = 'FAILED'
        payment.error_message = f'Student with ID {payment.student_admission_number} not found'
        payment.save()
        return
    
    # Get unpaid fees in chronological order (earliest first)
    remaining_amount = payment.amount
    fees_updated = []
    
    student_fees = StudentFee.objects.filter(
        student=student,
        is_paid=False
    ).select_related('fee_item', 'academic_year').order_by(
        'academic_year__start_date', 'term'
    )
    
    if not student_fees.exists():
        payment.status = 'FAILED'
        payment.error_message = 'No unpaid fees found for this student'
        payment.save()
        return
    
    # Apply payment across fees
    with transaction.atomic():
        for fee in student_fees:
            if remaining_amount <= 0:
                break
                
            amount_owed = fee.fee_item.amount - fee.amount_paid
            amount_to_apply = min(remaining_amount, amount_owed)
            
            fee.amount_paid = F('amount_paid') + amount_to_apply
            fee.save()
            
            # Refresh to get actual value after F() expression
            fee.refresh_from_db()
            
            if fee.amount_paid >= fee.fee_item.amount:
                fee.is_paid = True
                fee.save()
            
            fees_updated.append(fee)
            remaining_amount -= amount_to_apply
        
        # Update payment status
        if fees_updated:
            payment.status = 'MATCHED'
            payment.matched_fee = fees_updated[0]  # Link to primary fee
            
            if remaining_amount > 0:
                payment.error_message = f'Overpayment of KES {remaining_amount:.2f}. All fees cleared.'
            else:
                payment.error_message = None
        else:
            payment.status = 'FAILED'
            payment.error_message = 'Unable to apply payment'
        
        payment.save()


def batch_reconcile_payments(school=None):
    """
    Process all UNPROCESSED payments.
    Optional: filter by school.
    """
    payments = Payment.objects.filter(status='UNPROCESSED')
    if school:
        payments = payments.filter(school=school)
    
    total = payments.count()
    matched = 0
    failed = 0
    
    for payment in payments:
        reconcile_payment(payment)
        payment.refresh_from_db()
        
        if payment.status == 'MATCHED':
            matched += 1
        elif payment.status == 'FAILED':
            failed += 1
    
    return {
        'total': total,
        'matched': matched,
        'failed': failed
    }


def get_reconciliation_report(school=None):
    """
    Generate a reconciliation report for payments.
    """
    from django.db.models import Count, Sum, Q
    
    payments = Payment.objects.all()
    if school:
        payments = payments.filter(school=school)
    
    report = payments.aggregate(
        total_payments=Count('id'),
        total_amount=Sum('amount'),
        matched_count=Count('id', filter=Q(status='MATCHED')),
        matched_amount=Sum('amount', filter=Q(status='MATCHED')),
        failed_count=Count('id', filter=Q(status='FAILED')),
        failed_amount=Sum('amount', filter=Q(status='FAILED')),
        unprocessed_count=Count('id', filter=Q(status='UNPROCESSED')),
        unprocessed_amount=Sum('amount', filter=Q(status='UNPROCESSED')),
    )
    
    return report


def detect_duplicate_payments(school=None):
    """
    Detect potential duplicate transaction codes.
    """
    from django.db.models import Count
    
    payments = Payment.objects.all()
    if school:
        payments = payments.filter(school=school)
    
    duplicates = payments.values('transaction_code').annotate(
        count=Count('id')
    ).filter(count__gt=1)
    
    return duplicates


def get_unmatched_payments(school=None):
    """
    Get all failed payments with details.
    """
    payments = Payment.objects.filter(status='FAILED')
    if school:
        payments = payments.filter(school=school)
    
    return payments.select_related('school', 'uploaded_by').order_by('-transaction_date')