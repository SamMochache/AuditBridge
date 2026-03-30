# AuditBridge

**M-Pesa Fee Reconciliation & Reporting for Schools**

AuditBridge is a full-stack SaaS application that helps Kenyan schools reconcile M-Pesa paybill payments with student fee records. Upload a Safaricom paybill CSV export and the system automatically matches each payment to the correct student and fee item, tracks outstanding balances, and generates audit-ready reports.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Visit%20App-blue?style=for-the-badge)](https://audit-bridge-tau.vercel.app)
[![API](https://img.shields.io/badge/API-Render-green?style=for-the-badge)](https://auditbridge.onrender.com/api/)
[![Admin](https://img.shields.io/badge/Django%20Admin-Render-orange?style=for-the-badge)](https://auditbridge.onrender.com/admin/)

---

## Live Demo

| | URL |
|---|---|
| **Frontend** | https://audit-bridge-tau.vercel.app |
| **REST API** | https://auditbridge.onrender.com/api/ |
| **Django Admin** | https://auditbridge.onrender.com/admin/ |

### Test credentials

| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `admin123` |
| Accountant | `accountant` | `accountant123` |

> **Note:** The backend runs on Render's free tier and may take 30–60 seconds to respond after a period of inactivity (cold start). Subsequent requests are fast.

---

## Features

- **M-Pesa Paybill reconciliation** – upload the bulk CSV from the Safaricom Business portal; payments are automatically matched to students by admission number
- **Duplicate detection** – re-uploading the same statement skips already-imported transactions
- **Retry reconciliation** – re-trigger matching for any failed payment directly from the UI
- **Term-by-term analytics** – collection rates, fee-item breakdowns, and student payment status per term with visual charts
- **Dashboard** – live collection totals, outstanding balances, matched/failed counts, and recent transactions
- **Student ledger** – per-student fee breakdown grouped by term with paid/outstanding amounts
- **Payments audit trail** – immutable log of every transaction with uploaded-by and timestamp
- **JWT authentication** – secure login with access/refresh tokens and automatic token rotation
- **Role-based users** – ADMIN / TEACHER roles

---

## Tech Stack

| Layer     | Technology |
|-----------|-----------|
| Backend   | Django 5 · Django REST Framework · SimpleJWT |
| Database  | PostgreSQL (Neon serverless) |
| Frontend  | React 19 · Vite · Tailwind CSS · Zustand · Framer Motion |
| Auth      | JWT (access + refresh tokens, token blacklist on logout) |
| Hosting   | Vercel (frontend) · Render (backend) · Neon (database) |

---

## Quick Start

### Option A — Docker (recommended for local dev)

**Prerequisites:** Docker + Docker Compose

```bash
git clone https://github.com/YOUR_USERNAME/auditbridge.git
cd AuditBridge

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
git clone https://github.com/YOUR_USERNAME/auditbridge.git
cd AuditBridge
```

### 2. Backend setup

```bash
cd backend

python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

pip install -r requirements.txt

cp .env.example .env
# Edit .env – fill in SECRET_KEY, DB_PASSWORD, etc.

createdb auditbridge_db

python manage.py migrate
python manage.py seed_data

python manage.py runserver
```

The API will be at `http://localhost:8000/api/`.

### 3. Frontend setup

```bash
cd frontend

npm install

# Point at your local backend
echo "VITE_API_URL=http://localhost:8000/api" > .env.local

npm run dev
```

The app will be at `http://localhost:5173`.

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and set:

| Variable        | Description                          | Default              |
|-----------------|--------------------------------------|----------------------|
| `SECRET_KEY`    | Django secret key                    | insecure placeholder |
| `DEBUG`         | `True` / `False`                     | `True`               |
| `ALLOWED_HOSTS` | Comma-separated hostnames            | `localhost,127.0.0.1`|
| `DATABASE_URL`  | Full Postgres connection URL (Neon, etc.) | *(empty — uses DB_* vars)* |
| `DB_NAME`       | PostgreSQL database name             | `auditbridge_db`     |
| `DB_USER`       | PostgreSQL user                      | `postgres`           |
| `DB_PASSWORD`   | PostgreSQL password                  | *(empty)*            |
| `DB_HOST`       | PostgreSQL host                      | `localhost`          |
| `DB_PORT`       | PostgreSQL port                      | `5432`               |

> If `DATABASE_URL` is set it takes priority over the individual `DB_*` variables. Use this for hosted databases (Neon, Render Postgres, Railway, etc.).

---

## M-Pesa Payment Workflow

### How payments reach the system

1. **Parent pays** — dials `*334#` or uses the M-Pesa app → *Pay Bill* → enters the school's paybill number → enters the **student admission number** (e.g. `NA20260001`) as the account reference → confirms amount.
2. **School downloads statement** — logs into the [Safaricom M-Pesa Business portal](https://business.safaricom.co.ke) → *Payments* → *Statement* → selects date range → *Export as CSV*.
3. **Upload to AuditBridge** — drag the downloaded CSV into the Upload page. The system matches each row to a student and marks the relevant fee records as paid.

> **Important:** The account reference the parent enters when paying **must exactly match** the student's admission number in the system (e.g. `NA20260001`). This is how the system links the payment to the right student.

---

## M-Pesa CSV Upload

### Safaricom Paybill Statement format

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

A sample template can be downloaded from the **Upload** page in the app.

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

### Reports & Dashboard

| Method | Path                                      | Description              |
|--------|-------------------------------------------|--------------------------|
| GET    | `/api/payments/dashboard/stats/`          | Aggregate financials     |
| GET    | `/api/payments/dashboard/trends/`         | Daily collection totals  |
| GET    | `/api/payments/dashboard/class-balances/` | Per-class balances       |
| GET    | `/api/payments/dashboard/term-stats/`     | Term-by-term breakdown   |
| GET    | `/api/payments/audit-trail/`              | All payments, ordered by created_at |

---

## Project Structure

```
AuditBridge/
├── backend/
│   ├── .env.example               # Environment variable template
│   ├── requirements.txt
│   ├── manage.py
│   ├── entrypoint.sh              # Docker entrypoint (migrate + seed + gunicorn)
│   ├── Dockerfile
│   ├── config/
│   │   ├── settings/
│   │   │   ├── base.py            # Core settings (reads from .env / DATABASE_URL)
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
    ├── Dockerfile
    ├── nginx.conf
    ├── src/
    │   ├── pages/
    │   │   ├── Dashboard.jsx
    │   │   ├── Upload.jsx         # CSV upload with format guide
    │   │   ├── Payments.jsx       # Payment list + retry reconcile
    │   │   ├── Students.jsx
    │   │   ├── Analytics.jsx      # Term-by-term fee analytics
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

## Deployment

| Layer    | Service | Notes |
|----------|---------|-------|
| Frontend | [Vercel](https://vercel.com) | Set `VITE_API_URL` to your backend URL |
| Backend  | [Render](https://render.com) | Docker runtime, set `DATABASE_URL` + `SECRET_KEY` |
| Database | [Neon](https://neon.tech) | Free serverless PostgreSQL, always-on |

---

## Roadmap

| Feature | Value |
|---------|-------|
| **M-Pesa Daraja API (STK Push / C2B)** | Real-time payment notifications — no CSV download needed |
| **Parent SMS/WhatsApp receipts** | Auto-notify parents when a payment is received |
| **Fee balance reminder SMS** | Bulk SMS to parents with outstanding balances before a new term |
| **PDF fee statements & receipts** | Printable fee statement or official receipt per student |
| **Excel / PDF report export** | End-of-term financial reports for the principal and board |
| **Parent portal** | Parents log in via phone number to view fee balance and payment history |
| **Multi-school management** | One admin account manages multiple schools |
| **Fee structure per class** | Different fee amounts for different classes/streams |
| **Bank reconciliation** | Cross-check M-Pesa receipts against the school's bank statement |

---

## Development Notes

- **Seeding:** `python manage.py seed_data --clear` resets and re-seeds all demo data
- **Re-seed on Render:** set env var `RESEED=true` → redeploy → remove the var
- **Admin panel:** `python manage.py createsuperuser` then visit `/admin/`
- **CORS:** set to allow all origins in dev. Restrict to your domain in production
- **Timezone:** set to `Africa/Nairobi` (EAT, UTC+3) in `base.py`

---

## License

Copyright (c) 2026 AuditBridge

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
