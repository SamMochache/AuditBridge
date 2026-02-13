"""
Management command to seed the database with realistic test data.
Usage: python manage.py seed_data
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import datetime, timedelta
from decimal import Decimal
import random

from school.models import School
from accounts.models import User
from academics.models import Class, Student, AcademicYear, FeeItem, StudentFee
from payments.models import Payment


class Command(BaseCommand):
    help = 'Seed database with test data for AuditBridge'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing data before seeding',
        )

    def handle(self, *args, **options):
        if options['clear']:
            self.stdout.write('Clearing existing data...')
            Payment.objects.all().delete()
            StudentFee.objects.all().delete()
            Student.objects.all().delete()
            FeeItem.objects.all().delete()
            AcademicYear.objects.all().delete()
            Class.objects.all().delete()
            User.objects.filter(is_superuser=False).delete()
            School.objects.all().delete()
            self.stdout.write(self.style.SUCCESS('Data cleared!'))

        self.stdout.write('Starting data seeding...')

        # Create school
        school = School.objects.create(
            name="Nairobi Academy",
            paybill_number="247247"
        )
        self.stdout.write(f'Created school: {school.name}')

        # Create admin user
        admin_user = User.objects.create_user(
            username='admin',
            email='admin@nairobiacademy.ke',
            password='admin123',
            first_name='John',
            last_name='Kamau',
            role='ADMIN',
            school=school,
            is_staff=True
        )
        self.stdout.write(f'Created admin user: {admin_user.username}')

        # Create accountant user
        accountant = User.objects.create_user(
            username='accountant',
            email='accountant@nairobiacademy.ke',
            password='accountant123',
            first_name='Mary',
            last_name='Wanjiku',
            role='TEACHER',
            school=school
        )
        self.stdout.write(f'Created accountant user: {accountant.username}')

        # Create classes
        classes = []
        class_names = ['Form 1A', 'Form 1B', 'Form 2A', 'Form 2B', 'Form 3A', 'Form 4A']
        for class_name in class_names:
            cls = Class.objects.create(name=class_name, school=school)
            classes.append(cls)
        self.stdout.write(f'Created {len(classes)} classes')

        # Create academic year
        academic_year = AcademicYear.objects.create(
            name="2026",
            start_date=datetime(2026, 1, 6).date(),
            end_date=datetime(2026, 11, 30).date(),
            school=school
        )
        self.stdout.write(f'Created academic year: {academic_year.name}')

        # Create fee items
        fee_items = [
            FeeItem.objects.create(name="Tuition", amount=Decimal("50000.00"), school=school),
            FeeItem.objects.create(name="Sports", amount=Decimal("5000.00"), school=school),
            FeeItem.objects.create(name="Labs", amount=Decimal("8000.00"), school=school),
            FeeItem.objects.create(name="Library", amount=Decimal("3000.00"), school=school),
        ]
        self.stdout.write(f'Created {len(fee_items)} fee items')

        # Create students
        first_names = [
            'James', 'Mary', 'John', 'Elizabeth', 'Peter', 'Grace', 'David', 'Sarah',
            'Daniel', 'Ruth', 'Samuel', 'Esther', 'Joseph', 'Rebecca', 'Moses', 'Rachel',
            'Joshua', 'Hannah', 'Benjamin', 'Miriam', 'Timothy', 'Deborah', 'Stephen', 'Lydia'
        ]
        last_names = [
            'Kamau', 'Wanjiku', 'Ochieng', 'Akinyi', 'Mutua', 'Mwende', 'Kipchoge', 'Chebet',
            'Njoroge', 'Wambui', 'Otieno', 'Adhiambo', 'Kimani', 'Njeri', 'Mwangi', 'Nyambura'
        ]

        students = []
        student_count = 120  # 20 students per class
        
        for i in range(student_count):
            admission_num = f"NA{2026}{str(i+1).zfill(4)}"  # NA20260001, NA20260002, etc.
            student = Student.objects.create(
                first_name=random.choice(first_names),
                last_name=random.choice(last_names),
                student_id=admission_num,
                school=school,
                student_class=classes[i % len(classes)]
            )
            students.append(student)
        
        self.stdout.write(f'Created {len(students)} students')

        # Create student fees for each student
        for student in students:
            for term in [1, 2, 3]:
                for fee_item in fee_items:
                    StudentFee.objects.create(
                        student=student,
                        fee_item=fee_item,
                        academic_year=academic_year,
                        term=term,
                        amount_paid=Decimal("0.00"),
                        is_paid=False
                    )
        
        total_fees = StudentFee.objects.count()
        self.stdout.write(f'Created {total_fees} student fee records')

        # Create realistic payments
        # Scenario: We're in Term 1, some students have paid fully, some partially, some not at all
        
        payment_count = 0
        transaction_base = 100000
        
        # Mix of payment scenarios
        for i, student in enumerate(students):
            scenario = random.choice([
                'full_term1',      # 40% - Paid Term 1 fully
                'partial_term1',   # 30% - Paid Term 1 partially
                'overpaid',        # 10% - Overpaid (covered Term 1 + part of Term 2)
                'multiple_partial', # 15% - Made multiple small payments
                'not_paid'         # 5% - Haven't paid yet
            ])
            
            if scenario == 'not_paid':
                continue
            
            elif scenario == 'full_term1':
                # Single payment covering all Term 1 fees
                total_term1 = sum(fee_item.amount for fee_item in fee_items)
                Payment.objects.create(
                    school=school,
                    transaction_code=f"SKH{transaction_base + payment_count}",
                    student_admission_number=student.student_id,
                    amount=total_term1,
                    transaction_date=timezone.now() - timedelta(days=random.randint(1, 30)),
                    status='UNPROCESSED',
                    uploaded_by=accountant
                )
                payment_count += 1
            
            elif scenario == 'partial_term1':
                # Paid about 60-80% of Term 1
                total_term1 = sum(fee_item.amount for fee_item in fee_items)
                partial_amount = total_term1 * Decimal(str(random.uniform(0.6, 0.8)))
                Payment.objects.create(
                    school=school,
                    transaction_code=f"SKH{transaction_base + payment_count}",
                    student_admission_number=student.student_id,
                    amount=partial_amount.quantize(Decimal('0.01')),
                    transaction_date=timezone.now() - timedelta(days=random.randint(1, 25)),
                    status='UNPROCESSED',
                    uploaded_by=accountant
                )
                payment_count += 1
            
            elif scenario == 'overpaid':
                # Paid Term 1 + Term 2 tuition
                total_term1 = sum(fee_item.amount for fee_item in fee_items)
                overpayment = total_term1 + fee_items[0].amount  # + Tuition for Term 2
                Payment.objects.create(
                    school=school,
                    transaction_code=f"SKH{transaction_base + payment_count}",
                    student_admission_number=student.student_id,
                    amount=overpayment,
                    transaction_date=timezone.now() - timedelta(days=random.randint(5, 20)),
                    status='UNPROCESSED',
                    uploaded_by=accountant
                )
                payment_count += 1
            
            elif scenario == 'multiple_partial':
                # Made 2-3 small payments
                num_payments = random.randint(2, 3)
                total_term1 = sum(fee_item.amount for fee_item in fee_items)
                total_paid = total_term1 * Decimal(str(random.uniform(0.5, 0.9)))
                
                per_payment = (total_paid / num_payments).quantize(Decimal('0.01'))
                
                for j in range(num_payments):
                    Payment.objects.create(
                        school=school,
                        transaction_code=f"SKH{transaction_base + payment_count}",
                        student_admission_number=student.student_id,
                        amount=per_payment,
                        transaction_date=timezone.now() - timedelta(days=random.randint(1, 30)),
                        status='UNPROCESSED',
                        uploaded_by=accountant
                    )
                    payment_count += 1
        
        self.stdout.write(f'Created {payment_count} payments')

        # Create some intentional errors for testing
        # 1. Payment with wrong admission number
        Payment.objects.create(
            school=school,
            transaction_code=f"SKH{transaction_base + payment_count}",
            student_admission_number="NA20269999",  # Non-existent
            amount=Decimal("25000.00"),
            transaction_date=timezone.now() - timedelta(days=5),
            status='UNPROCESSED',
            uploaded_by=accountant
        )
        payment_count += 1

        # 2. Duplicate transaction code (will fail unique constraint when processed)
        # We'll skip this to avoid breaking the seed
        
        self.stdout.write(self.style.SUCCESS(f'Seeding complete!'))
        self.stdout.write(self.style.SUCCESS(f'Summary:'))
        self.stdout.write(f'  - School: {school.name}')
        self.stdout.write(f'  - Students: {len(students)}')
        self.stdout.write(f'  - Classes: {len(classes)}')
        self.stdout.write(f'  - Fee Items: {len(fee_items)}')
        self.stdout.write(f'  - Student Fees: {total_fees}')
        self.stdout.write(f'  - Payments: {payment_count}')
        self.stdout.write(self.style.WARNING(f'\nLogin credentials:'))
        self.stdout.write(f'  Admin - username: admin, password: admin123')
        self.stdout.write(f'  Accountant - username: accountant, password: accountant123')
        self.stdout.write(self.style.WARNING(f'\nRun reconciliation:'))
        self.stdout.write(f'  POST to /api/payments/reconcile/')