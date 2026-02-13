from django.db import models
from school.models import School
from accounts.models import User

class Payment(models.Model):

    STATUS_CHOICES = [
        ('UNPROCESSED', 'Unprocessed'),
        ('MATCHED', 'Matched'),
        ('PENDING', 'Pending'),
        ('FAILED', 'Failed'),
    ]

    school = models.ForeignKey(School, on_delete=models.CASCADE)

    # Raw mpesa data
    transaction_code = models.CharField(max_length=50, unique=True)
    student_admission_number = models.CharField(max_length=20)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    transaction_date = models.DateTimeField()

    # system info
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='UNPROCESSED')
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.transaction_code} - {self.amount} - {self.status}"
