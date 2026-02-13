from django.db import models
from school.models import School
from accounts.models import User

class Payment(models.Model):

    STATUS_CHOICES = [
        ('UNPROCESSED', 'Unprocessed'),
        ('MATCHED', 'Matched'),
        ('FAILED', 'Failed'),
    ]

    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='payments')

    # Raw mpesa data
    transaction_code = models.CharField(max_length=50, unique=True)
    student_admission_number = models.CharField(max_length=20)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    transaction_date = models.DateTimeField()

    # Reconciliation tracking
    matched_fee = models.ForeignKey(
        'academics.StudentFee',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='payments'
    )
    error_message = models.TextField(blank=True, null=True)
    
    # System info
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='UNPROCESSED')
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-transaction_date']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['student_admission_number']),
            models.Index(fields=['transaction_code']),
        ]

    def __str__(self):
        return f"{self.transaction_code} - {self.amount} - {self.status}"