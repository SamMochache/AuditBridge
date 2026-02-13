from payments.models import Payment
from academics.models import StudentFee

def reconcile_payment(payment: Payment):
    """
    Match a payment to the first unpaid StudentFee of the student in the school.
    """
    try:
        student_fees = StudentFee.objects.filter(
            student__student_id=payment.student_admission_number,
            is_paid=False,
            student__school=payment.school
        ).order_by('academic_year', 'term')

        if student_fees.exists():
            fee = student_fees.first()
            fee.amount_paid += payment.amount
            if fee.amount_paid >= fee.fee_item.amount:
                fee.is_paid = True
            fee.save()

            payment.matched_fee = fee
            payment.status = 'MATCHED'
            payment.save()
        else:
            payment.status = 'FAILED'
            payment.save()
    except Exception as e:
        payment.status = 'FAILED'
        payment.save()
        raise e


def batch_reconcile_payments(school=None):
    """
    Process all PENDING payments.
    Optional: filter by school.
    """
    payments = Payment.objects.filter(status='PENDING')
    if school:
        payments = payments.filter(school=school)

    for payment in payments:
        reconcile_payment(payment)
