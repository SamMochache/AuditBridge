import csv
import re
from datetime import datetime
from decimal import Decimal, InvalidOperation
from django.utils import timezone
from payments.models import Payment


# ─── Column aliases for different M-Pesa export formats ──────────────────────
COLUMN_ALIASES = {
    'transaction_code': [
        'Receipt No.', 'Receipt No', 'Mpesa Receipt No', 'Transaction ID',
        'Receipt Number', 'TransactionID', 'RECEIPT NO', 'M-PESA Ref',
        'Reference No.', 'Ref No.', 'Trans ID',
    ],
    'transaction_date': [
        'Completion Time', 'Transaction Date', 'Date', 'Completion Date',
        'Transaction Time', 'COMPLETION TIME', 'Trans Date', 'Payment Date',
    ],
    'amount': [
        'Paid In', 'Amount', 'Paid in', 'Credit', 'Amount Paid',
        'PAID IN', 'Debit', 'Trans Amount',
    ],
    'account': [
        'A/C No.', 'Account', 'Account Number', 'A/C No', 'Acc No',
        'Bill Ref Number', 'Reference', 'Account Reference', 'A/C NO',
        'Student ID', 'Admission No',
    ],
    'status': [
        'Transaction Status', 'Status', 'TRANSACTION STATUS', 'Trans Status',
    ],
    'details': [
        'Details', 'DETAILS', 'Narration', 'Description',
    ],
}

# Date formats used across different M-Pesa export versions
DATE_FORMATS = [
    '%Y-%m-%d %H:%M:%S',
    '%d/%m/%Y %H:%M:%S',
    '%d/%m/%Y %H:%M',
    '%m/%d/%Y %H:%M:%S',
    '%m/%d/%Y %H:%M',
    '%Y-%m-%dT%H:%M:%S',
    '%d-%m-%Y %H:%M:%S',
    '%Y/%m/%d %H:%M:%S',
    '%d/%m/%Y',
    '%Y-%m-%d',
]


def _find_column(headers, aliases):
    """Return the actual header string that matches any of the aliases."""
    header_map = {h.strip().lower(): h.strip() for h in headers}
    for alias in aliases:
        if alias.strip().lower() in header_map:
            return header_map[alias.strip().lower()]
    return None


def _parse_amount(value):
    """
    Parse a money string like '50,000.00' or '50000' into a Decimal.
    Returns None if the value is empty, zero, or non-numeric.
    """
    if not value:
        return None
    try:
        cleaned = value.strip().replace(',', '').replace(' ', '')
        amount = Decimal(cleaned)
        return amount if amount > 0 else None
    except (InvalidOperation, ValueError):
        return None


def _parse_date(value):
    """
    Try each known date format and return an aware datetime, or None.
    """
    if not value:
        return None
    value = value.strip()
    for fmt in DATE_FORMATS:
        try:
            dt = datetime.strptime(value, fmt)
            return timezone.make_aware(dt, timezone.get_current_timezone())
        except ValueError:
            continue
    return None


def _extract_account_from_details(details):
    """
    Extract the paybill account reference (student ID) from the M-Pesa
    'Details' free-text field.

    Safaricom embeds the account reference after labels like:
      "Account Number NA20260001"
      "Acc NA20260001"
      "A/C NA20260001"
    """
    if not details:
        return None
    patterns = [
        r'Account\s+Number\s+(\S+)',
        r'Account\s+No\.?\s+(\S+)',
        r'\bAcc\s+(\S+)',
        r'\bA/C\s+(\S+)',
    ]
    for pattern in patterns:
        match = re.search(pattern, details, re.IGNORECASE)
        if match:
            return match.group(1).strip().rstrip('.,;')
    return None


def _extract_receipt_from_details(details):
    """
    Extract the M-Pesa receipt code from a Details/Narration string.
    M-Pesa codes follow the pattern: 2-3 uppercase letters + 6-9 alphanumeric chars.
    Examples: QCV1234567, SKH100001, LHG98765432
    """
    if not details:
        return None
    match = re.search(r'\b([A-Z]{2,3}[A-Z0-9]{6,9})\b', details)
    return match.group(1) if match else None


def _skip_preamble(lines):
    """
    Some Safaricom exports include bank-style preamble rows (e.g. "Business Name:",
    "Account:", "Period:") before the actual CSV header row.
    This function skips those rows and returns lines starting from the header.
    """
    trigger_words = {'receipt', 'completion', 'paid in', 'transaction', 'details', 'amount', 'balance'}
    for i, line in enumerate(lines):
        line_lower = line.lower()
        if sum(1 for word in trigger_words if word in line_lower) >= 2:
            return lines[i:]
    return lines


def parse_mpesa_csv(file, school, uploaded_by):
    """
    Parse an M-Pesa Paybill statement CSV and create Payment records.

    Supported formats
    -----------------
    Format A – Simple/custom export:
        Transaction Date, Amount, Mpesa Receipt No, Account

    Format B – Safaricom Paybill Statement (with Receipt No. column):
        Receipt No., Completion Time, Details, Transaction Status, Paid In,
        Withdrawn, Balance

    Format C – Safaricom Paybill Statement (with A/C No. column):
        Initiation Time, Completion Time, Details, Transaction Status, Paid In,
        Withdrawn, Balance, Balance Confirmed, Linked Transaction ID, A/C No., MSISDN

    The parser auto-detects which format is in use.

    Returns
    -------
    dict:
        created            – number of Payment rows created
        skipped_duplicates – rows skipped because transaction_code already exists
        errors             – list of human-readable error strings for bad rows
    """
    # Decode, stripping UTF-8 BOM if present
    content = file.read().decode('utf-8-sig')
    lines = content.splitlines()

    lines = _skip_preamble(lines)
    if not lines:
        return {'created': 0, 'skipped_duplicates': 0, 'errors': ['No valid data found in the CSV.']}

    reader = csv.DictReader(lines)
    headers = reader.fieldnames or []

    # Map logical field names to actual column headers
    code_col    = _find_column(headers, COLUMN_ALIASES['transaction_code'])
    date_col    = _find_column(headers, COLUMN_ALIASES['transaction_date'])
    amount_col  = _find_column(headers, COLUMN_ALIASES['amount'])
    account_col = _find_column(headers, COLUMN_ALIASES['account'])
    status_col  = _find_column(headers, COLUMN_ALIASES['status'])
    details_col = _find_column(headers, COLUMN_ALIASES['details'])

    if not date_col:
        raise ValueError(
            "Cannot find a transaction date column. "
            "Expected 'Completion Time' or 'Transaction Date'."
        )
    if not amount_col:
        raise ValueError(
            "Cannot find an amount column. "
            "Expected 'Paid In' or 'Amount'."
        )

    created = 0
    skipped_duplicates = 0
    errors = []

    for row_num, row in enumerate(reader, start=2):
        # ── 1. Amount ─────────────────────────────────────────────────────────
        raw_amount = row.get(amount_col, '').strip()
        if not raw_amount:
            # Blank amount means a non-payment row (withdrawal, charge, etc.)
            continue
        amount = _parse_amount(raw_amount)
        if amount is None:
            continue  # zero or malformed – silently skip

        # ── 2. Date ───────────────────────────────────────────────────────────
        raw_date = row.get(date_col, '').strip()
        transaction_date = _parse_date(raw_date)
        if not transaction_date:
            errors.append(f"Row {row_num}: unrecognised date format '{raw_date}'")
            continue

        # ── 3. Transaction status (skip non-Completed rows if column exists) ──
        if status_col:
            txn_status = row.get(status_col, '').strip().lower()
            if txn_status and txn_status not in ('completed', 'success', ''):
                continue

        # ── 4. Transaction / receipt code ─────────────────────────────────────
        transaction_code = None
        if code_col:
            transaction_code = row.get(code_col, '').strip() or None
        if not transaction_code and details_col:
            transaction_code = _extract_receipt_from_details(row.get(details_col, ''))
        if not transaction_code:
            errors.append(f"Row {row_num}: could not determine M-Pesa receipt number")
            continue

        # ── 5. Account / student admission number ─────────────────────────────
        student_admission_number = None
        if account_col:
            student_admission_number = row.get(account_col, '').strip() or None
        if not student_admission_number and details_col:
            student_admission_number = _extract_account_from_details(row.get(details_col, ''))
        if not student_admission_number:
            errors.append(
                f"Row {row_num}: could not find student account reference "
                f"for receipt {transaction_code}"
            )
            continue

        # ── 6. Duplicate guard ────────────────────────────────────────────────
        if Payment.objects.filter(transaction_code=transaction_code).exists():
            skipped_duplicates += 1
            continue

        # ── 7. Create record ──────────────────────────────────────────────────
        Payment.objects.create(
            school=school,
            student_admission_number=student_admission_number,
            transaction_code=transaction_code,
            amount=amount,
            transaction_date=transaction_date,
            uploaded_by=uploaded_by,
        )
        created += 1

    return {
        'created': created,
        'skipped_duplicates': skipped_duplicates,
        'errors': errors,
    }
