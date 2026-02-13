from django.db import models
from school.models import School
from accounts.models import User

class Class(models.Model):
    name = models.CharField(max_length=100)
    school = models.ForeignKey(
        School,
        on_delete=models.CASCADE,
        related_name='classes'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.school.name})"

class Student(models.Model):
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    student_id = models.CharField(max_length=20, unique=True)
    school = models.ForeignKey(
        School,
        on_delete=models.CASCADE,
        related_name='students'
    )
    student_class = models.ForeignKey(
        Class,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='students'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.student_class.name if self.student_class else 'No class'})"


class Subject(models.Model):
    name = models.CharField(max_length=100)
    school = models.ForeignKey(
        'school.School',
        on_delete=models.CASCADE,
        related_name='subjects'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.school.name})"


class Enrollment(models.Model):
    student = models.ForeignKey(
        'Student',
        on_delete=models.CASCADE,
        related_name='enrollments'
    )
    subject = models.ForeignKey(
        Subject,
        on_delete=models.CASCADE,
        related_name='enrollments'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('student', 'subject')

    def __str__(self):
        return f"{self.student} -> {self.subject}"


class TeacherSubject(models.Model):
    teacher = models.ForeignKey(
        User,
        limit_choices_to={'role': 'TEACHER'},
        on_delete=models.CASCADE,
        related_name='teaching_subjects'
    )
    subject = models.ForeignKey(
        Subject,
        on_delete=models.CASCADE,
        related_name='teachers'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('teacher', 'subject')

    def __str__(self):
        return f"{self.teacher} teaches {self.subject}"


class AcademicYear(models.Model):
    name = models.CharField(max_length=20, unique=True)  # e.g., "2026" or "2026-2027"
    start_date = models.DateField()
    end_date = models.DateField()
    school = models.ForeignKey(
        'school.School',
        on_delete=models.CASCADE,
        related_name='academic_years'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.school.name})"

class FeeItem(models.Model):
    name = models.CharField(max_length=100)  # Tuition, Sports, Labs
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    school = models.ForeignKey(
        'school.School',
        on_delete=models.CASCADE,
        related_name='fee_items'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.school.name}) - {self.amount}"


class StudentFee(models.Model):
    TERM_CHOICES = (
        (1, 'Term 1'),
        (2, 'Term 2'),
        (3, 'Term 3'),
    )

    student = models.ForeignKey(
        'Student',
        on_delete=models.CASCADE,
        related_name='fees'
    )
    fee_item = models.ForeignKey(
        FeeItem,
        on_delete=models.CASCADE,
        related_name='student_fees'
    )
    academic_year = models.ForeignKey(
        AcademicYear,
        on_delete=models.CASCADE,
        related_name='student_fees'
    )
    term = models.IntegerField(choices=TERM_CHOICES, default=1)
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    is_paid = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('student', 'fee_item', 'academic_year', 'term')

    def __str__(self):
        return f"{self.student} owes {self.fee_item} ({self.academic_year} Term {self.term})"
