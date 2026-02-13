from rest_framework import serializers
from payments.models import Payment
from academics.models import Student, StudentFee, Class, AcademicYear, FeeItem
from school.models import School


class SchoolSerializer(serializers.ModelSerializer):
    class Meta:
        model = School
        fields = ['id', 'name', 'paybill_number', 'created_at']


class ClassSerializer(serializers.ModelSerializer):
    student_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Class
        fields = ['id', 'name', 'school', 'student_count', 'created_at']
    
    def get_student_count(self, obj):
        return obj.students.count()


class AcademicYearSerializer(serializers.ModelSerializer):
    class Meta:
        model = AcademicYear
        fields = ['id', 'name', 'start_date', 'end_date', 'school', 'created_at']


class FeeItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = FeeItem
        fields = ['id', 'name', 'amount', 'school', 'created_at']


class StudentFeeSerializer(serializers.ModelSerializer):
    fee_item_name = serializers.CharField(source='fee_item.name', read_only=True)
    fee_item_amount = serializers.DecimalField(
        source='fee_item.amount',
        max_digits=10,
        decimal_places=2,
        read_only=True
    )
    academic_year_name = serializers.CharField(source='academic_year.name', read_only=True)
    balance = serializers.SerializerMethodField()
    
    class Meta:
        model = StudentFee
        fields = [
            'id', 'student', 'fee_item', 'fee_item_name', 'fee_item_amount',
            'academic_year', 'academic_year_name', 'term', 'amount_paid',
            'balance', 'is_paid', 'created_at'
        ]
    
    def get_balance(self, obj):
        return obj.fee_item.amount - obj.amount_paid


class StudentSerializer(serializers.ModelSerializer):
    class_name = serializers.CharField(source='student_class.name', read_only=True)
    total_fees_owed = serializers.SerializerMethodField()
    total_fees_paid = serializers.SerializerMethodField()
    outstanding_balance = serializers.SerializerMethodField()
    fees = StudentFeeSerializer(many=True, read_only=True)
    
    class Meta:
        model = Student
        fields = [
            'id', 'first_name', 'last_name', 'student_id', 'school',
            'student_class', 'class_name', 'total_fees_owed',
            'total_fees_paid', 'outstanding_balance', 'fees', 'created_at'
        ]
    
    def get_total_fees_owed(self, obj):
        from django.db.models import Sum
        total = obj.fees.aggregate(total=Sum('fee_item__amount'))['total']
        return total or 0
    
    def get_total_fees_paid(self, obj):
        from django.db.models import Sum
        total = obj.fees.aggregate(total=Sum('amount_paid'))['total']
        return total or 0
    
    def get_outstanding_balance(self, obj):
        return self.get_total_fees_owed(obj) - self.get_total_fees_paid(obj)


class StudentListSerializer(serializers.ModelSerializer):
    """Lighter serializer for list views"""
    class_name = serializers.CharField(source='student_class.name', read_only=True)
    outstanding_balance = serializers.SerializerMethodField()
    payment_status = serializers.SerializerMethodField()
    
    class Meta:
        model = Student
        fields = [
            'id', 'first_name', 'last_name', 'student_id',
            'class_name', 'outstanding_balance', 'payment_status'
        ]
    
    def get_outstanding_balance(self, obj):
        from django.db.models import Sum, F
        balance = obj.fees.aggregate(
            balance=Sum(F('fee_item__amount') - F('amount_paid'))
        )['balance']
        return balance or 0
    
    def get_payment_status(self, obj):
        balance = self.get_outstanding_balance(obj)
        if balance == 0:
            return 'PAID'
        elif balance > 0:
            unpaid_count = obj.fees.filter(is_paid=False).count()
            total_count = obj.fees.count()
            if unpaid_count == total_count:
                return 'UNPAID'
            else:
                return 'PARTIAL'
        return 'UNKNOWN'


class PaymentSerializer(serializers.ModelSerializer):
    school_name = serializers.CharField(source='school.name', read_only=True)
    uploaded_by_name = serializers.SerializerMethodField()
    student_name = serializers.SerializerMethodField()
    matched_fee_details = serializers.SerializerMethodField()
    
    class Meta:
        model = Payment
        fields = [
            'id', 'school', 'school_name', 'transaction_code',
            'student_admission_number', 'student_name', 'amount',
            'transaction_date', 'status', 'error_message',
            'matched_fee', 'matched_fee_details', 'uploaded_by',
            'uploaded_by_name', 'created_at', 'updated_at'
        ]
    
    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return f"{obj.uploaded_by.first_name} {obj.uploaded_by.last_name}"
        return None
    
    def get_student_name(self, obj):
        try:
            student = Student.objects.get(
                student_id=obj.student_admission_number,
                school=obj.school
            )
            return f"{student.first_name} {student.last_name}"
        except Student.DoesNotExist:
            return None
    
    def get_matched_fee_details(self, obj):
        if obj.matched_fee:
            return {
                'fee_item': obj.matched_fee.fee_item.name,
                'academic_year': obj.matched_fee.academic_year.name,
                'term': obj.matched_fee.term
            }
        return None


class PaymentUploadSerializer(serializers.Serializer):
    """Serializer for CSV upload"""
    file = serializers.FileField()
    
    def validate_file(self, value):
        if not value.name.endswith('.csv'):
            raise serializers.ValidationError("Only CSV files are allowed")
        return value