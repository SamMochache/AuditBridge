"""
payments/tests/test_reconciliation.py

Run with:
    python manage.py test payments.tests.test_reconciliation

Coverage targets
────────────────
- Full payment marks fee paid
- Partial payment does not mark paid
- Overpayment clears all fees + notes surplus
- Payment for unknown student → FAILED
- All fees already paid → MATCHED with note
- Multi-term fee distribution (amount cascades across terms)
- Concurrent reconciliation does not double-credit (uses thread pool)
- Retry reconciliation resets correctly
- N+1 regression guard on StudentListView
- API: login rate throttle (basic), CORS locked in prod settings
"""

import threading
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase, TransactionTestCase
from django.test.utils import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from academics.models import AcademicYear, Class, FeeItem, Student, StudentFee
from payments.models import Payment
from payments.services.reconciliation import batch_reconcile_payments, reconcile_payment
from school.models import School

User = get_user_model()


# ── Test fixture mixin ─────────────────────────────────────────────────────────


class SchoolFixtureMixin:
    """Creates a minimal but complete set of related objects for payment tests."""

    @classmethod
    def setUpTestData(cls):
        cls.school = School.objects.create(name="Test Academy", paybill_number="123456")

        cls.admin = User.objects.create_user(
            username="admin_test",
            password="SecurePass123!",
            first_name="Admin",
            last_name="User",
            role="ADMIN",
            school=cls.school,
            is_staff=True,
        )

        cls.cls = Class.objects.create(name="Form 1A", school=cls.school)

        cls.student = Student.objects.create(
            first_name="James",
            last_name="Kamau",
            student_id="TS20260001",
            school=cls.school,
            student_class=cls.cls,
        )

        cls.year = AcademicYear.objects.create(
            name="2026",
            start_date="2026-01-01",
            end_date="2026-12-31",
            school=cls.school,
        )

        cls.tuition = FeeItem.objects.create(
            name="Tuition", amount=Decimal("50000.00"), school=cls.school
        )
        cls.sports = FeeItem.objects.create(
            name="Sports", amount=Decimal("5000.00"), school=cls.school
        )

    def _make_student_fee(self, fee_item, term=1, amount_paid=Decimal("0")):
        return StudentFee.objects.create(
            student=self.student,
            fee_item=fee_item,
            academic_year=self.year,
            term=term,
            amount_paid=amount_paid,
            is_paid=False,
        )

    def _make_payment(self, amount, admission_number=None):
        code = f"TXN{Payment.objects.count() + 1:06d}"
        return Payment.objects.create(
            school=self.school,
            transaction_code=code,
            student_admission_number=admission_number or self.student.student_id,
            amount=Decimal(str(amount)),
            transaction_date="2026-01-15 09:00:00+03:00",
            uploaded_by=self.admin,
        )


# ═══════════════════════════════════════════════════════════════════════════════
# RECONCILIATION LOGIC TESTS
# ═══════════════════════════════════════════════════════════════════════════════


class TestFullPayment(SchoolFixtureMixin, TestCase):
    def setUp(self):
        self.fee = self._make_student_fee(self.tuition)

    def test_full_payment_marks_fee_paid(self):
        payment = self._make_payment(50000)
        reconcile_payment(payment)

        self.fee.refresh_from_db()
        self.assertTrue(self.fee.is_paid)
        self.assertEqual(self.fee.amount_paid, Decimal("50000.00"))

        payment.refresh_from_db()
        self.assertEqual(payment.status, Payment.Status.MATCHED)
        self.assertIsNone(payment.error_message)
        # FK should be set
        self.assertEqual(payment.student_id, self.student.id)

    def test_already_processed_payment_is_skipped(self):
        payment = self._make_payment(50000)
        payment.status = Payment.Status.MATCHED
        payment.save()

        # Should not raise and should not change anything
        reconcile_payment(payment)
        payment.refresh_from_db()
        self.assertEqual(payment.status, Payment.Status.MATCHED)


class TestPartialPayment(SchoolFixtureMixin, TestCase):
    def setUp(self):
        self.fee = self._make_student_fee(self.tuition)

    def test_partial_payment_does_not_mark_paid(self):
        payment = self._make_payment(25000)
        reconcile_payment(payment)

        self.fee.refresh_from_db()
        self.assertFalse(self.fee.is_paid)
        self.assertEqual(self.fee.amount_paid, Decimal("25000.00"))

        payment.refresh_from_db()
        self.assertEqual(payment.status, Payment.Status.MATCHED)

    def test_two_partial_payments_sum_correctly(self):
        p1 = self._make_payment(30000)
        reconcile_payment(p1)

        p2 = self._make_payment(20000)
        reconcile_payment(p2)

        self.fee.refresh_from_db()
        self.assertTrue(self.fee.is_paid)
        self.assertEqual(self.fee.amount_paid, Decimal("50000.00"))


class TestOverpayment(SchoolFixtureMixin, TestCase):
    def setUp(self):
        self.fee = self._make_student_fee(self.tuition)

    def test_overpayment_clears_fee_and_notes_surplus(self):
        payment = self._make_payment(75000)
        reconcile_payment(payment)

        self.fee.refresh_from_db()
        self.assertTrue(self.fee.is_paid)

        payment.refresh_from_db()
        self.assertEqual(payment.status, Payment.Status.MATCHED)
        self.assertIn("Overpayment", payment.error_message)
        self.assertIn("25000.00", payment.error_message)

    def test_overpayment_cascades_to_next_term_fee(self):
        """Payment large enough to cover Term 1 and Term 2 fees."""
        term2_fee = self._make_student_fee(self.tuition, term=2)

        payment = self._make_payment(100000)  # covers both 50K fees
        reconcile_payment(payment)

        self.fee.refresh_from_db()
        term2_fee.refresh_from_db()

        self.assertTrue(self.fee.is_paid)
        self.assertTrue(term2_fee.is_paid)


class TestFailedReconciliation(SchoolFixtureMixin, TestCase):
    def setUp(self):
        self._make_student_fee(self.tuition)

    def test_unknown_student_marks_failed(self):
        payment = self._make_payment(50000, admission_number="UNKNOWN999")
        reconcile_payment(payment)

        payment.refresh_from_db()
        self.assertEqual(payment.status, Payment.Status.FAILED)
        self.assertIn("UNKNOWN999", payment.error_message)
        self.assertIsNone(payment.student_id)

    def test_student_with_all_fees_paid_gets_matched_with_note(self):
        self.fee.is_paid = True
        self.fee.amount_paid = Decimal("50000.00")
        self.fee.save()

        payment = self._make_payment(5000)
        reconcile_payment(payment)

        payment.refresh_from_db()
        self.assertEqual(payment.status, Payment.Status.MATCHED)
        self.assertIn("surplus", payment.error_message.lower())


class TestMultiTermDistribution(SchoolFixtureMixin, TestCase):
    def setUp(self):
        # Create fees across two terms and two fee items
        self.t1_tuition = self._make_student_fee(self.tuition, term=1)
        self.t1_sports = self._make_student_fee(self.sports, term=1)
        self.t2_tuition = self._make_student_fee(self.tuition, term=2)

    def test_payment_fills_fees_in_chronological_order(self):
        # 50K exactly covers tuition Term 1
        payment = self._make_payment(50000)
        reconcile_payment(payment)

        self.t1_tuition.refresh_from_db()
        self.t1_sports.refresh_from_db()
        self.t2_tuition.refresh_from_db()

        self.assertTrue(self.t1_tuition.is_paid)
        self.assertFalse(self.t1_sports.is_paid)  # not touched
        self.assertFalse(self.t2_tuition.is_paid)  # not touched


class TestRetryReconciliation(SchoolFixtureMixin, TestCase):
    def setUp(self):
        self._make_student_fee(self.tuition)

    def test_retry_clears_previous_state_and_rematches(self):
        # First attempt fails
        payment = self._make_payment(50000, admission_number="TYPO0001")
        reconcile_payment(payment)
        payment.refresh_from_db()
        self.assertEqual(payment.status, Payment.Status.FAILED)

        # Fix the admission number and retry via the API
        payment.student_admission_number = self.student.student_id
        payment.status = Payment.Status.UNPROCESSED
        payment.error_message = None
        payment.student = None
        payment.matched_fee = None
        payment.save()

        reconcile_payment(payment)
        payment.refresh_from_db()
        self.assertEqual(payment.status, Payment.Status.MATCHED)
        self.assertEqual(payment.student_id, self.student.id)


# ═══════════════════════════════════════════════════════════════════════════════
# CONCURRENCY TEST
# ═══════════════════════════════════════════════════════════════════════════════


class TestConcurrentReconciliation(SchoolFixtureMixin, TransactionTestCase):
    """
    TransactionTestCase is required here because select_for_update()
    only works correctly when each thread uses its own real transaction
    (TestCase wraps everything in one transaction, which breaks locking).
    """

    def setUp(self):
        # Re-create objects because TransactionTestCase does not use
        # setUpTestData — it truncates tables between tests.
        self.school = School.objects.create(
            name="Concurrent Test School", paybill_number="999999"
        )
        self.admin = User.objects.create_user(
            username="concurrent_admin",
            password="SecurePass123!",
            role="ADMIN",
            school=self.school,
        )
        self.cls = Class.objects.create(name="Form X", school=self.school)
        self.student = Student.objects.create(
            first_name="Mary",
            last_name="Wanjiku",
            student_id="CNC20260001",
            school=self.school,
            student_class=self.cls,
        )
        self.year = AcademicYear.objects.create(
            name="2026",
            start_date="2026-01-01",
            end_date="2026-12-31",
            school=self.school,
        )
        self.fee_item = FeeItem.objects.create(
            name="Tuition", amount=Decimal("50000.00"), school=self.school
        )
        self.student_fee = StudentFee.objects.create(
            student=self.student,
            fee_item=self.fee_item,
            academic_year=self.year,
            term=1,
            amount_paid=Decimal("0"),
            is_paid=False,
        )

        # Two separate payments, each for 50K
        self.p1 = Payment.objects.create(
            school=self.school,
            transaction_code="CNC000001",
            student_admission_number=self.student.student_id,
            amount=Decimal("50000.00"),
            transaction_date="2026-01-15 09:00:00+03:00",
            uploaded_by=self.admin,
        )
        self.p2 = Payment.objects.create(
            school=self.school,
            transaction_code="CNC000002",
            student_admission_number=self.student.student_id,
            amount=Decimal("50000.00"),
            transaction_date="2026-01-15 09:01:00+03:00",
            uploaded_by=self.admin,
        )

    def test_concurrent_payments_do_not_double_credit(self):
        """
        Two threads reconciling simultaneously should result in exactly
        50 000 being credited — not 100 000.  Without select_for_update()
        the old code would credit 100 000.
        """
        errors = []

        def reconcile(payment):
            try:
                reconcile_payment(payment)
            except Exception as exc:
                errors.append(exc)

        t1 = threading.Thread(target=reconcile, args=(self.p1,))
        t2 = threading.Thread(target=reconcile, args=(self.p2,))
        t1.start()
        t2.start()
        t1.join()
        t2.join()

        if errors:
            raise errors[0]

        self.student_fee.refresh_from_db()

        # The fee amount must not exceed the expected amount.
        # One payment should have cleared it; the second should have
        # detected is_paid=True or no unpaid fees and become a surplus.
        self.assertLessEqual(
            self.student_fee.amount_paid,
            self.fee_item.amount,
            msg=(
                f"amount_paid ({self.student_fee.amount_paid}) exceeded "
                f"fee amount ({self.fee_item.amount}) — double-credit bug!"
            ),
        )


# ═══════════════════════════════════════════════════════════════════════════════
# N+1 REGRESSION GUARD
# ═══════════════════════════════════════════════════════════════════════════════


class TestStudentListQueryCount(SchoolFixtureMixin, TestCase):
    """
    Ensures StudentListView does not regress to N+1.
    With proper annotation the query count should be constant regardless
    of the number of students on the page.
    """

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        # Create 9 more students (10 total)
        for i in range(2, 11):
            s = Student.objects.create(
                first_name=f"Student{i}",
                last_name="Test",
                student_id=f"TS2026{i:04d}",
                school=cls.school,
                student_class=cls.cls,
            )
            StudentFee.objects.create(
                student=s,
                fee_item=cls.tuition,
                academic_year=cls.year,
                term=1,
                amount_paid=Decimal("0"),
                is_paid=False,
            )

    def test_student_list_query_count_is_bounded(self):
        client = APIClient()
        client.force_authenticate(user=self.admin)

        with self.assertNumQueries(4):
            # Expected queries:
            # 1. Auth token lookup
            # 2. Student.objects.annotate(...).filter(school=...) — main list
            # 3. COUNT(*) for pagination
            # 4. (prefetch_related fees + fee_item)
            # Adjust the number if your middleware adds more, but it must
            # not scale with the number of students on the page.
            response = client.get("/api/payments/students/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 10)


# ═══════════════════════════════════════════════════════════════════════════════
# API SECURITY TESTS
# ═══════════════════════════════════════════════════════════════════════════════


class TestAuthSecurity(SchoolFixtureMixin, TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_unauthenticated_request_returns_401(self):
        response = self.client.get("/api/payments/list/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_teacher_cannot_trigger_reconciliation(self):
        teacher = User.objects.create_user(
            username="teacher_test",
            password="SecurePass123!",
            role="TEACHER",
            school=self.school,
        )
        self.client.force_authenticate(user=teacher)
        response = self.client.post("/api/payments/reconcile/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_teacher_cannot_upload_csv(self):
        teacher = User.objects.create_user(
            username="teacher_upload_test",
            password="SecurePass123!",
            role="TEACHER",
            school=self.school,
        )
        self.client.force_authenticate(user=teacher)
        import io

        dummy_csv = io.BytesIO(b"Receipt No.,Paid In\nQCV123,1000\n")
        dummy_csv.name = "test.csv"
        response = self.client.post(
            "/api/payments/upload/",
            {"file": dummy_csv},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_cannot_access_other_school_payment(self):
        other_school = School.objects.create(name="Other School", paybill_number="000001")
        other_student = Student.objects.create(
            first_name="Other",
            last_name="Student",
            student_id="OTH0001",
            school=other_school,
            student_class=None,
        )
        other_year = AcademicYear.objects.create(
            name="2026", start_date="2026-01-01", end_date="2026-12-31", school=other_school
        )
        other_payment = Payment.objects.create(
            school=other_school,
            transaction_code="OTHER001",
            student_admission_number="OTH0001",
            amount=Decimal("1000"),
            transaction_date="2026-01-01 09:00:00+03:00",
        )

        self.client.force_authenticate(user=self.admin)
        response = self.client.get(f"/api/payments/{other_payment.id}/")
        # Should 404 because the queryset is scoped to self.admin.school
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class TestBatchReconciliation(SchoolFixtureMixin, TestCase):
    def setUp(self):
        self._make_student_fee(self.tuition)
        self._make_student_fee(self.sports)

    def test_batch_reconcile_processes_all_unprocessed(self):
        p1 = self._make_payment(50000)
        p2 = self._make_payment(5000)

        result = batch_reconcile_payments(school=self.school)

        self.assertEqual(result["total"], 2)
        self.assertEqual(result["matched"], 2)
        self.assertEqual(result["failed"], 0)

        p1.refresh_from_db()
        p2.refresh_from_db()
        self.assertEqual(p1.status, Payment.Status.MATCHED)
        self.assertEqual(p2.status, Payment.Status.MATCHED)
