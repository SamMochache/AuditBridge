"""
payments/models.py

Changes from original
─────────────────────
1. Status choices moved into a nested Status class so every piece of code
   references Payment.Status.MATCHED instead of the bare string 'MATCHED'.
   This eliminates an entire category of typo bugs and makes grep/refactor
   trivially safe.

2. `student` ForeignKey (nullable) added.  This is set during reconciliation
   when a student match is found.  It allows PaymentSerializer to get the
   student name via select_related() instead of firing a separate query per
   row (the old get_student_name() method).  Existing rows will have
   student=NULL until they are re-reconciled or migrated.

3. `update_fields` is now used in reconciliation saves — the model is wide
   enough that a full save() is wasteful.
"""

from django.db import models

from accounts.models import User
from school.models import School


class Payment(models.Model):

    class Status(models.TextChoices):
        UNPROCESSED = "UNPROCESSED", "Unprocessed"
        MATCHED = "MATCHED", "Matched"
        FAILED = "FAILED", "Failed"

    school = models.ForeignKey(
        School,
        on_delete=models.CASCADE,
        related_name="payments",
    )

    # ── Raw M-Pesa data (written once at import time, never mutated) ──────────
    transaction_code = models.CharField(max_length=50, unique=True)
    student_admission_number = models.CharField(max_length=20)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    transaction_date = models.DateTimeField()

    # ── Resolved references (written during reconciliation) ───────────────────
    # student is NULL until reconciliation succeeds.  Using SET_NULL so that
    # deleting a student does not cascade-delete payment history.
    student = models.ForeignKey(
        "academics.Student",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="payments",
    )
    matched_fee = models.ForeignKey(
        "academics.StudentFee",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="payments",
    )
    error_message = models.TextField(blank=True, null=True)

    # ── System metadata ───────────────────────────────────────────────────────
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.UNPROCESSED,
        db_index=True,
    )
    uploaded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name="uploaded_payments",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-transaction_date"]
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["student_admission_number"]),
            models.Index(fields=["transaction_code"]),
            # Composite index used by the student ledger view
            models.Index(fields=["school", "status"]),
        ]

    def __str__(self) -> str:
        return f"{self.transaction_code} — KES {self.amount} — {self.status}"
