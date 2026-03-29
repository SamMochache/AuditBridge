# AuditBridge

**M-Pesa Fee Reconciliation &amp; Reporting for Schools**

AuditBridge is a full-stack SaaS application that helps Kenyan schools reconcile M-Pesa paybill payments with student fee records. Upload a Safaricom paybill CSV export and the system automatically matches each payment to the correct student and fee item, tracks outstanding balances, and generates audit-ready reports.

---

## Features

- **One-click CSV upload** – drag and drop a Safaricom paybill statement or simple CSV
- **Automatic reconciliation** – payments are matched to students by admission number and applied across multiple fee items
- **Duplicate detection** – re-uploading the same file skips already-imported transactions
- **Retry reconciliation** – manually re-trigger matching for any failed payment from the UI
- **Dashboard** – collection totals, outstanding balances, matched/failed counts, collection rate
- **Student ledger** – per-student fee breakdown grouped by term with paid/outstanding amounts
- **Payments audit trail** – immutable log of every transaction with uploaded-by info
- **JWT authentication** – secure login with token refresh
- **Role-based users** – ADMIN / TEACHER roles

---

## Tech Stack

| Layer     | Technology |
|-----------|-----------|
| Backend   | Django 5 · Django REST Framework · SimpleJWT |
| Database  | PostgreSQL |
| Frontend  | React 19 · Vite · Tailwind CSS · Zustand · Framer Motion |
| Auth      | JWT (access + refresh tokens, token blacklist on logout) |

---

## Quick Start

### Option A — Docker (recommended)

The fastest way to run the full stack.

**Prerequisites:** Docker + Docker Compose

```bash
git clone <repo-url>
cd AuditBridge

# Ensure backend/.env exists with at least DB_PASSWORD set
# (copy from the example if needed)
cp backend/.env.example backend/.env
# Edit backend/.env → set DB_PASSWORD and SECRET_KEY

docker compose up --build
```

| Service  | URL                          |
|----------|------------------------------|
| App      | http://localhost             |
| API      | http://localhost/api/        |
| Admin    | http://localhost/admin/      |

To seed demo data on first run:

```bash
docker compose exec backend python manage.py seed_data
```

To stop and remove containers:

```bash
docker compose down          # keep the database volume
docker compose down -v       # also delete the database
```

---

### Option B — Local development

### Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL 14+

### 1. Clone

```bash
git clone <repo-url>
cd AuditBridge
```

### 2. Backend setup

```bash
cd backend

# Create and activate virtualenv
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env – fill in SECRET_KEY, DB_PASSWORD, etc.

# Create database (PostgreSQL)
createdb auditbridge_db           # or use psql / pgAdmin

# Run migrations
python manage.py migrate

# Seed demo data (optional but recommended)
python manage.py seed_data

# Start server
python manage.py runserver
```

The API will be at `http://localhost:8000/api/`.

### 3. Frontend setup

```bash
cd frontend

# Install dependencies
npm install

# (Optional) create .env.local to point at a different backend
echo "VITE_API_URL=http://localhost:8000/api" > .env.local

# Start dev server
npm run dev
```

The app will be at `http://localhost:5173`.

### 4. Default login credentials (after seed)

| Role       | Username    | Password       |
|------------|-------------|----------------|
| Admin      | admin       | admin123       |
| Accountant | accountant  | accountant123  |

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and set:

| Variable       | Description                          | Default             |
|----------------|--------------------------------------|---------------------|
| `SECRET_KEY`   | Django secret key                    | insecure placeholder |
| `DEBUG`        | `True` / `False`                     | `True`              |
| `ALLOWED_HOSTS`| Comma-separated hostnames            | `localhost,127.0.0.1` |
| `DB_NAME`      | PostgreSQL database name             | `auditbridge_db`    |
| `DB_USER`      | PostgreSQL user                      | `postgres`          |
| `DB_PASSWORD`  | PostgreSQL password                  | *(empty)*           |
| `DB_HOST`      | PostgreSQL host                      | `localhost`         |
| `DB_PORT`      | PostgreSQL port                      | `5432`              |

---

## M-Pesa CSV Upload

### Supported formats

AuditBridge auto-detects the CSV format. Two formats are supported:

#### Format A – Safaricom Paybill Statement (recommended)

The standard export from the **Safaricom M-Pesa Business portal**. Download it via:
*Business* → *Payments* → *Statement* → *Export as CSV*

```
Receipt No.,Completion Time,Details,Transaction Status,Paid In,Withdrawn,Balance
QCV1234567,15/01/2026 09:30:47,"Pay Bill Online    QCV1234567 James Kamau 0712345678  Account Number NA20260001",Completed,50000.00,,150000.00
SKH9876543,15/01/2026 10:15:22,"Pay Bill Online    SKH9876543 Mary Wanjiku 0723456789  Account Number NA20260002",Completed,25000.00,,175000.00
```

The parser extracts:
- **Receipt number** from the `Receipt No.` column (or from the `Details` text)
- **Student admission number** from the `A/C No.` column (if present) or from the `Details` text after `"Account Number "` / `"Account "` / `"Acc "`
- **Amount** from `Paid In`
- **Date** from `Completion Time`

Rows with a blank `Paid In` (withdrawals, charges) are automatically skipped.

#### Format B – Simple / Custom

```
Transaction Date,Amount,Mpesa Receipt No,Account
2026-01-15 09:30:00,50000.00,QCV1234567,NA20260001
2026-01-15 10:15:00,25000.00,SKH9876543,NA20260002
```

| Column              | Required | Notes                                         |
|---------------------|----------|-----------------------------------------------|
| `Transaction Date`  | Yes      | `YYYY-MM-DD HH:MM:SS` or `DD/MM/YYYY HH:MM`  |
| `Amount`            | Yes      | Numeric, no currency symbol                   |
| `Mpesa Receipt No`  | Yes      | 10-character M-Pesa code e.g. `QCV1234567`   |
| `Account`           | Yes      | Student admission number e.g. `NA20260001`    |

Sample template files can be downloaded from the **Upload** page in the app.

### Reconciliation logic

1. For each uploaded payment the system looks up the student by `student_admission_number`.
2. If found, unpaid fee records are fetched in chronological order (earliest term first).
3. The payment amount is applied sequentially across fees until exhausted.
4. If the payment covers more than outstanding fees the surplus is noted; the payment is still marked **Matched**.
5. If the student is not found the payment is marked **Failed** with an error description.

---

## API Reference

All endpoints require `Authorization: Bearer <access_token>` except auth endpoints.

### Authentication

| Method | Path                        | Description            |
|--------|-----------------------------|------------------------|
| POST   | `/api/auth/register/`       | Register new user      |
| POST   | `/api/auth/login/`          | Login, returns tokens  |
| POST   | `/api/auth/logout/`         | Invalidate refresh token |
| POST   | `/api/auth/token/refresh/`  | Refresh access token   |
| GET    | `/api/auth/profile/`        | Get current user       |
| PUT    | `/api/auth/profile/`        | Update profile         |
| POST   | `/api/auth/change-password/`| Change password        |

### Payments

| Method | Path                          | Description                        |
|--------|-------------------------------|------------------------------------|
| POST   | `/api/payments/upload/`       | Upload M-Pesa CSV                  |
| GET    | `/api/payments/list/`         | List payments (paginated, filterable) |
| GET    | `/api/payments/<id>/`         | Payment detail                     |
| POST   | `/api/payments/reconcile/`    | Re-run batch reconciliation        |
| POST   | `/api/payments/<id>/retry/`   | Retry a single failed payment      |
| GET    | `/api/payments/unmatched/`    | List failed payments               |

Query params for `/list/`: `status`, `search`, `start_date`, `end_date`, `page`, `page_size`

### Students

| Method | Path                               | Description          |
|--------|------------------------------------|----------------------|
| GET    | `/api/payments/students/`          | List students        |
| GET    | `/api/payments/students/<id>/`     | Student detail       |
| GET    | `/api/payments/students/<id>/fees/`| Student fee records  |

Query params for `/students/`: `search`, `payment_status` (PAID/UNPAID), `class_id`

### Reports &amp; Dashboard

| Method | Path                                   | Description              |
|--------|----------------------------------------|--------------------------|
| GET    | `/api/payments/dashboard/stats/`       | Aggregate financials     |
| GET    | `/api/payments/dashboard/trends/`      | Daily collection totals  |
| GET    | `/api/payments/dashboard/class-balances/` | Per-class balances    |
| GET    | `/api/payments/audit-trail/`           | All payments, ordered by created_at |

---

## Project Structure

```
AuditBridge/
├── backend/
│   ├── .env.example               # Environment variable template
│   ├── requirements.txt
│   ├── manage.py
│   ├── config/
│   │   ├── settings/
│   │   │   ├── base.py            # Core settings (reads from .env)
│   │   │   └── dev.py
│   │   └── urls.py
│   ├── accounts/                  # User auth (JWT)
│   ├── school/                    # School model
│   ├── academics/                 # Student, Class, Fee models
│   └── payments/
│       ├── models.py              # Payment model
│       ├── views.py               # API views
│       ├── serializers.py
│       ├── urls.py
│       ├── parsers/
│       │   └── mpesa_parser.py    # Multi-format M-Pesa CSV parser
│       ├── services/
│       │   └── reconciliation.py  # Fee matching logic
│       └── management/commands/
│           └── seed_data.py       # Demo data generator
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── Dashboard.jsx
    │   │   ├── Upload.jsx         # CSV upload with format guide
    │   │   ├── Payments.jsx       # Payment list + retry reconcile
    │   │   ├── Students.jsx
    │   │   ├── Settings.jsx
    │   │   └── Login.jsx
    │   ├── services/
    │   │   ├── api.js             # Axios instance + token refresh
    │   │   ├── authService.js
    │   │   └── paymentsService.js
    │   └── components/
    │       ├── layout/
    │       └── ui/
    └── package.json
```

---

## Development Notes

- **Seeding**: `python manage.py seed_data --clear` resets and re-seeds all demo data.
- **Admin panel**: `python manage.py createsuperuser` then visit `http://localhost:8000/admin/`.
- **CORS**: set to allow all origins in dev (`CORS_ALLOW_ALL_ORIGINS = True`). Restrict to your domain in production.
- **Timezone**: set to `Africa/Nairobi` (EAT, UTC+3) in `base.py`.

---

## License

MIT
