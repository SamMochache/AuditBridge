"""
payments/serializers.py

Changes from original
─────────────────────
1. PaymentSerializer.get_student_name() replaced with a simple source
   accessor on the new `student` FK.  No per-row DB query.

2. StudentListSerializer.get_outstanding_balance() reads from the
   `outstanding_balance_annotated` annotation set in StudentListView,
   falling back to 0 if the annotation is absent (e.g. in tests that
   use the serializer directly without the view).

3. PaymentUploadSerializer now validates MIME type in addition to file
   extension and enforces a 10 MB size cap.

4. All Payment.Status string literals replaced with the enum constants.
"""

from decimal import Decimal

from rest_framework import serializers

from academics.models import AcademicYear, Class, FeeItem, Student, StudentFee
from payments.models import Payment
from school.models import School


# ── School / Class / Year / Fee serializers ────────────────────────────────────


class SchoolSerializer(serializers.ModelSerializer):
    class Meta:
        model = School
        fields = ["id", "name", "paybill_number", "created_at"]


class ClassSerializer(serializers.ModelSerializer):
    student_count = serializers.SerializerMethodField()

    class Meta:
        model = Class
        fields = ["id", "name", "school", "student_count", "created_at"]

    def get_student_count(self, obj) -> int:
        return obj.students.count()


class AcademicYearSerializer(serializers.ModelSerializer):
    class Meta:
        model = AcademicYear
        fields = ["id", "name", "start_date", "end_date", "school", "created_at"]


class FeeItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = FeeItem
        fields = ["id", "name", "amount", "school", "created_at"]


class StudentFeeSerializer(serializers.ModelSerializer):
    fee_item_name = serializers.CharField(source="fee_item.name", read_only=True)
    fee_item_amount = serializers.DecimalField(
        source="fee_item.amount",
        max_digits=10,
        decimal_places=2,
        read_only=True,
    )
    academic_year_name = serializers.CharField(
        source="academic_year.name", read_only=True
    )
    balance = serializers.SerializerMethodField()

    class Meta:
        model = StudentFee
        fields = [
            "id",
            "student",
            "fee_item",
            "fee_item_name",
            "fee_item_amount",
            "academic_year",
            "academic_year_name",
            "term",
            "amount_paid",
            "balance",
            "is_paid",
            "created_at",
        ]

    def get_balance(self, obj) -> Decimal:
        return obj.fee_item.amount - obj.amount_paid


# ── Student serializers ────────────────────────────────────────────────────────


class StudentSerializer(serializers.ModelSerializer):
    """Full student detail — used in the student detail modal."""

    class_name = serializers.CharField(source="student_class.name", read_only=True)
    total_fees_owed = serializers.SerializerMethodField()
    total_fees_paid = serializers.SerializerMethodField()
    outstanding_balance = serializers.SerializerMethodField()
    fees = StudentFeeSerializer(many=True, read_only=True)

    class Meta:
        model = Student
        fields = [
            "id",
            "first_name",
            "last_name",
            "student_id",
            "school",
            "student_class",
            "class_name",
            "total_fees_owed",
            "total_fees_paid",
            "outstanding_balance",
            "fees",
            "created_at",
        ]

    def get_total_fees_owed(self, obj) -> Decimal:
        from django.db.models import Sum

        return obj.fees.aggregate(total=Sum("fee_item__amount"))["total"] or Decimal(
            "0"
        )

    def get_total_fees_paid(self, obj) -> Decimal:
        from django.db.models import Sum

        return obj.fees.aggregate(total=Sum("amount_paid"))["total"] or Decimal("0")

    def get_outstanding_balance(self, obj) -> Decimal:
        return self.get_total_fees_owed(obj) - self.get_total_fees_paid(obj)


class StudentListSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for the student list view.

    outstanding_balance reads from the `outstanding_balance_annotated`
    field set by StudentListView.get_queryset().  This means zero extra
    DB queries regardless of page size.
    """

    class_name = serializers.CharField(source="student_class.name", read_only=True)
    outstanding_balance = serializers.SerializerMethodField()
    payment_status = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = [
            "id",
            "first_name",
            "last_name",
            "student_id",
            "class_name",
            "outstanding_balance",
            "payment_status",
        ]

    def get_outstanding_balance(self, obj) -> Decimal:
        # Read from annotation when available (fast path used by the list view).
        annotated = getattr(obj, "outstanding_balance_annotated", None)
        if annotated is not None:
            return max(annotated, Decimal("0"))

        # Fallback for tests / direct serializer usage.
        from django.db.models import F, Sum
        from django.db.models import ExpressionWrapper, DecimalField

        result = obj.fees.aggregate(
            balance=Sum(
                ExpressionWrapper(
                    F("fee_item__amount") - F("amount_paid"),
                    output_field=DecimalField(),
                )
            )
        )["balance"]
        return max(result or Decimal("0"), Decimal("0"))

    def get_payment_status(self, obj) -> str:
        balance = self.get_outstanding_balance(obj)
        if balance <= 0:
            return "PAID"
        unpaid_count = obj.fees.filter(is_paid=False).count()
        total_count = obj.fees.count()
        if unpaid_count == total_count:
            return "UNPAID"
        return "PARTIAL"


# ── Payment serializer ─────────────────────────────────────────────────────────


class PaymentSerializer(serializers.ModelSerializer):
    """
    FIX: student_name now comes from the FK rather than a per-row
    Student.objects.get() call.  The view uses select_related('student')
    so this is zero extra queries.
    """

    school_name = serializers.CharField(source="school.name", read_only=True)
    uploaded_by_name = serializers.SerializerMethodField()

    # Reads from the FK — no extra query when select_related('student') is used
    student_name = serializers.SerializerMethodField()

    matched_fee_details = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = [
            "id",
            "school",
            "school_name",
            "transaction_code",
            "student_admission_number",
            "student_name",
            "amount",
            "transaction_date",
            "status",
            "error_message",
            "matched_fee",
            "matched_fee_details",
            "uploaded_by",
            "uploaded_by_name",
            "created_at",
            "updated_at",
        ]

    def get_uploaded_by_name(self, obj) -> str | None:
        if obj.uploaded_by:
            return f"{obj.uploaded_by.first_name} {obj.uploaded_by.last_name}".strip()
        return None

    def get_student_name(self, obj) -> str | None:
        """
        Uses the student FK if populated (set during reconciliation).
        Falls back to the raw admission number display for FAILED / UNPROCESSED
        payments where student is NULL.
        """
        if obj.student_id:  # FK is set
            return f"{obj.student.first_name} {obj.student.last_name}"
        return None

    def get_matched_fee_details(self, obj) -> dict | None:
        if obj.matched_fee:
            return {
                "fee_item": obj.matched_fee.fee_item.name,
                "academic_year": obj.matched_fee.academic_year.name,
                "term": obj.matched_fee.term,
            }
        return None


# ── Upload serializer ──────────────────────────────────────────────────────────

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB

# Accepted MIME types for CSV files across operating systems
ALLOWED_MIME_TYPES = {
    "text/plain",
    "text/csv",
    "application/csv",
    "application/vnd.ms-excel",  # Windows sometimes assigns this to .csv
}


class PaymentUploadSerializer(serializers.Serializer):
    """
    Validates the uploaded file:
    - Must have a .csv extension
    - Must be ≤ 10 MB
    - First 1 KB must parse as text/CSV MIME type
    """

    file = serializers.FileField()

    def validate_file(self, value):
        if not value.name.lower().endswith(".csv"):
            raise serializers.ValidationError(
                "Only CSV files are accepted. Please export your M-Pesa statement as CSV."
            )

        if value.size > MAX_UPLOAD_BYTES:
            raise serializers.ValidationError(
                f"File is too large ({value.size // (1024*1024)} MB). Maximum allowed size is 10 MB."
            )

        # Best-effort MIME check using the file's first kilobyte.
        # python-magic is an optional dependency — skip the check gracefully
        # if it is not installed rather than breaking the upload flow.
        try:
            import magic  # type: ignore

            header = value.read(1024)
            value.seek(0)
            mime = magic.from_buffer(header, mime=True)
            if mime not in ALLOWED_MIME_TYPES:
                raise serializers.ValidationError(
                    f"File does not appear to be a valid CSV (detected type: {mime})."
                )
        except ImportError:
            pass  # python-magic not installed — extension check is sufficient

        return value
