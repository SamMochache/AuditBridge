import csv
from datetime import datetime
from payments.models import Payment

def parse_mpesa_csv(file, school, uploaded_by):
    """
    Parse CSV file exported from M-Pesa Paybill statement.
    Expected columns: 'Transaction Date', 'Amount', 'Mpesa Receipt No', 'Account'
    """
    reader = csv.DictReader(file.read().decode().splitlines())
    for row in reader:
        Payment.objects.create(
            school=school,
            student_admission_number=row.get("Account"),
            transaction_code=row.get("Mpesa Receipt No"),
            amount=row.get("Amount"),
            transaction_date=datetime.strptime(row.get("Transaction Date"), "%Y-%m-%d %H:%M:%S"),
            uploaded_by=uploaded_by,
        )

