"""
Migration: add student FK to Payment and update Status field + indexes.

Run: python manage.py migrate payments
"""

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("academics", "0003_academicyear_feeitem_studentfee"),
        ("payments", "0001_initial"),
    ]

    operations = [
        # 1. Add the student FK (nullable so existing rows are unaffected)
        migrations.AddField(
            model_name="payment",
            name="student",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="payments",
                to="academics.student",
            ),
        ),
        # 2. Add composite index on (school, status) used by dashboard queries
        migrations.AddIndex(
            model_name="payment",
            index=models.Index(
                fields=["school", "status"],
                name="payments_school_status_idx",
            ),
        ),
        # 3. Make status field db_index=True explicitly
        migrations.AlterField(
            model_name="payment",
            name="status",
            field=models.CharField(
                choices=[
                    ("UNPROCESSED", "Unprocessed"),
                    ("MATCHED", "Matched"),
                    ("FAILED", "Failed"),
                ],
                db_index=True,
                default="UNPROCESSED",
                max_length=20,
            ),
        ),
    ]
