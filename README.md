# HRIS (Human Resource Information System)

Full-stack starter aligned with centralized employee data, RBAC, core HR modules, REST API, and a React admin/employee UI.

## Stack

- **Backend:** Node.js, Express 5, TypeScript, Prisma 5, PostgreSQL, JWT (bcrypt password hashing), Multer uploads, PDF payslips (pdfkit), Excel export (xlsx).
- **Frontend:** Vite, React 18, TypeScript, Tailwind CSS, React Router (proxy to API in dev).

## Quick start

1. **PostgreSQL** — use Docker (recommended):

   ```bash
   docker compose up -d
   ```

2. **Backend** — copy env and migrate:

   ```bash
   cd backend
   cp .env.example .env
   npx prisma migrate deploy
   npm run prisma:seed
   npm run dev
   ```

   API: `http://localhost:4000` · health: `GET /api/health`

3. **Frontend:**

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

   App: `http://localhost:5173` (proxies `/api` and `/uploads` to the backend).

## Seed users (password `ChangeMe123!`)

| Email | Role |
| --- | --- |
| `superadmin@hris.local` | SUPER_ADMIN |
| `hradmin@hris.local` | HR_ADMIN |
| `depthead@hris.local` | DEPARTMENT_HEAD (Engineering) |
| `employee@hris.local` | EMPLOYEE (linked profile) |

## Implemented modules (API + UI)

- **Daily workflows (UI):** Leave requests & balances, approvals (HR / dept head), self-service attendance, payroll runs → generate → lines → PDF/Excel, profile self-edit (`PATCH /api/employees/me`), **company filter** in header for scoped lists.
- **Business rules:** Leave **balance decreases on approval** (with insufficient-balance guard). Attendance **late / undertime / overtime** from **branch schedule** (`scheduleStartTime`, `graceLateMins`, `expectedWorkMins`).
- **Recruitment:** **Public** job list + **apply** with resume (`/api/recruitment/public/*`, no auth). Internal **ATS** pipeline UI + `GET /api/recruitment/applicants` for HR.
- **Email:** `nodemailer` — optional `SMTP_*` env vars; logs to console if unset. Sends on leave decision, broadcast channel `EMAIL`, optional `PAYROLL_NOTIFY_EMAIL=true` after payroll generate.
- **PH payroll:** Versioned tables in `backend/data/ph-payroll-tables.json` (starter brackets — validate for production). Lines store `tableVersion` in `metaJson`.
- **Hardening:** Rate limit on `POST /api/auth/login`, Vitest + Supertest (`npm test`), GitHub Actions CI (`.github/workflows/ci.yml`).
- **Ops / extras:** Document expiry listing + **HR notification job** (`POST /api/cron/document-expiry-alerts`), **QR attendance** (`POST /api/attendance/qr-scan`), backup notes in `docs/BACKUP.md`.

## Security notes

- Set a strong `JWT_SECRET` and HTTPS in production.
- Validate `ph-payroll-tables.json` against official agency releases before production payroll.
- Enable DB backups and object-store backups for uploads; see `docs/BACKUP.md`.

## Node version

Prisma 5 supports Node 18+. For Prisma 7+, use Node 20+.
