from django.contrib import admin
from .models import Class, Student, Subject, Enrollment, TeacherSubject, AcademicYear, FeeItem, StudentFee

admin.site.register(Class)
admin.site.register(Student)
admin.site.register(Subject)
admin.site.register(Enrollment)
admin.site.register(TeacherSubject)
admin.site.register(AcademicYear)
admin.site.register(FeeItem)
admin.site.register(StudentFee)