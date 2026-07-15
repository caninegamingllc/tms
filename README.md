# Freight Broker TMS

A Freight Broker Transportation Management System inspired by the broad workflow of AscendTMS. It is built as a Next.js app with **PostgreSQL**, optional **S3-compatible document storage**, **Redis** (rate limits/cache), and a **background job worker** for PDF generation and mailbox sync.

## What It Includes

- Dashboard for active loads, revenue, margin, open AR, open AP, and check calls.
- Load management with customer tender details, stops, status workflow, pricing, clone load, documents, notes, and activity history.
- Customer CRM with contacts, credit limits, payment terms, late fees, invoice exposure, load counts, and customer portal access.
- Carrier CRM with MC/DOT fields, insurance expiration, compliance status, equipment, and load history.
- Dispatch board with carrier assignments, driver/truck/trailer details, check calls, and uncovered loads.
- Customer portal (`/portal`) for load map/board tracking, customer-safe load details, and invoice review with payment URL.
- Document library and generated paperwork for carrier rate confirmations, BOLs, customer invoices, POD, carrier packet, insurance, W-9, and other documents (S3-compatible or local storage).
- Accounting for customer invoices, carrier bills, open receivables, open payables, late fees on overdue invoice email, and gross margin.
- Reports for profitability, lanes, customer volume, and carrier performance.
- Admin console with login, users, roles, branches, password resets, account lock/disable controls, and audit logs.
- Google and Microsoft 365 sign-in for login, company registration, and passwordless invite accept.
- Per-user Gmail / Outlook mailbox connect to email invoices, customer load confirmations, carrier rate confirmations, and POD requests, with reply sync on loads.
- Background job worker for PDF generation and mailbox sync; optional Redis for shared rate limits/cache.
- Integrations placeholders for DAT, Truckstop, tracking, and factoring (QuickBooks Online + IIF are implemented).

For a single thorough project review, see [`docs/PROJECT_REVIEW.md`](docs/PROJECT_REVIEW.md). Supporting companions: [`docs/SYSTEM_DESCRIPTION.md`](docs/SYSTEM_DESCRIPTION.md), [`docs/PROJECT_OVERVIEW.md`](docs/PROJECT_OVERVIEW.md).

## First-Time Setup

1. Install Node.js from https://nodejs.org if you do not already have it.
2. Start local infra (Postgres + Redis + MinIO):

```bash
docker compose up -d
```

3. Copy `.env.example` to `.env` (defaults point at local Postgres from compose).
4. Install dependencies and migrate/seed:

```bash
npm install
npm run setup
```

5. Start the app (and optionally the worker):

```bash
npm run dev
# in another terminal:
npm run worker
```

For production cutover from a legacy SQLite file, see `scripts/migrate-sqlite-to-postgres.ts` and `scripts/migrate-uploads-to-s3.ts`.

6. Open http://localhost:3000.

## Development Login

The seeded owner account is:

```text
Email: owner@example.com
Password: ChangeMe123!
```

The seeded dispatcher account is:

```text
Email: dispatch@example.com
Password: ChangeMe123!
```

The dispatcher is forced to change password on first login so you can test that workflow.

## Useful Commands

```bash
npm run dev        # prisma generate + migrate deploy + next dev
npm run build      # verify the production build
npm run worker     # background jobs (PDF generate, mailbox sync)
npm run setup      # generate Prisma, migrate, and seed demo data
npm run db:migrate # apply Prisma migrations to Postgres
npm run db:seed    # add demo customers, carriers, loads, and accounting data
npm run db:reset   # reset the local database and seed it again
```

## Demo Workflow

After seeding, open the dashboard and inspect `GLB-1001` and `GLB-1002`.

- `GLB-1001` shows a covered/dispatch workflow with a carrier, driver, check call, documents, invoice, and carrier bill.
- `GLB-1002` is available freight that needs carrier coverage.
- Use `Loads > New Load` to create another shipment.
- Use the load detail page to assign a carrier, update status, add check calls, and attach document records.
- Use the load detail page `Documents` panel to generate carrier rate confirmations, customer load confirmations, bills of lading, and customer invoice documents.
- Connect your mailbox under **Email settings** (sidebar), then use **Email Rate Con / Load Con / Invoice / POD Request** on a load.
- Open generated documents from `Documents`, then use `Print / Save PDF` to print or save a PDF from your browser.
- Use `Accounting` to create invoices and carrier bills.
- Use `Accounting > Generate Customer Invoice Document` to generate printable invoices from accounting.
- Use `Admin` as the owner to create users, reset passwords, force password changes, lock/unlock accounts, disable/enable accounts, create branches, and review the audit log.

## Next Real Integrations

Some integration tiles are still placeholders by design. Recommended next steps are:

- Configure S3-compatible storage (`S3_*`) and Redis (`REDIS_URL`) in every production environment if not already set.
- Add multi-factor authentication before handling highly sensitive brokerage data at scale.
- Connect DAT or Truckstop for load posting and carrier search.
- Connect tracking/document-capture providers for automated check calls and POD capture.
- Optional: Stripe Connect (or similar) for in-portal AR card capture — portal Pay CTAs currently use remittance URLs.

## OAuth Setup (Google / Microsoft)

1. Set `APP_BASE_URL` and a token encryption key (`TOKEN_ENCRYPTION_KEY` or `INTUIT_TOKEN_ENCRYPTION_KEY`).
2. Create a Google OAuth client with redirect URIs for identity and mail callbacks (see `.env.example`). Enable the Gmail API for mailbox send/sync.
3. Register a Microsoft Entra app with delegated `Mail.Send` and `Mail.Read`, plus the identity redirect URIs.
4. Fill `GOOGLE_*` and `MICROSOFT_*` values in `.env`, restart the app, then use the buttons on Login / Register / Accept invite, and **Email settings** for mailbox connect.
