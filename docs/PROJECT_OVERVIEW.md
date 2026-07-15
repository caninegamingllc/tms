# Freight Broker TMS — Project Overview

**Version:** 0.4.4  
**Production URL:** https://tms.simple-source.com  
**Narrative summary:** [`SYSTEM_DESCRIPTION.md`](./SYSTEM_DESCRIPTION.md)

A multi-tenant freight brokerage TMS inspired by AscendTMS-style workflows. One Next.js app handles broker operations (CRM, dispatch, documents, accounting, commissions, email ops, admin billing) plus a separate **customer portal** for load tracking and invoice review.

---

## Table of Contents

1. [Stack & Architecture](#stack--architecture)
2. [Local Setup](#local-setup)
3. [Environment Variables](#environment-variables)
4. [Authentication & Access Control](#authentication--access-control)
5. [Multi-Tenancy, Branches & Seats](#multi-tenancy-branches--seats)
6. [Feature Catalog](#feature-catalog)
7. [Customer Portal](#customer-portal)
8. [API Routes](#api-routes)
9. [Integrations](#integrations)
10. [Database Model Summary](#database-model-summary)
11. [UI System](#ui-system)
12. [Background Jobs, Redis & Storage](#background-jobs-redis--storage)
13. [Production Deploy](#production-deploy)
14. [Useful Commands & Scripts](#useful-commands--scripts)
15. [Demo Seed Data](#demo-seed-data)
16. [Known Placeholders / Next Steps](#known-placeholders--next-steps)
17. [Directory Map](#directory-map-high-level)

---

## Stack & Architecture

| Layer | Choice |
|-------|--------|
| Framework | Next.js (App Router), React, TypeScript |
| Styling | Tailwind CSS |
| ORM / DB | Prisma 6 + **PostgreSQL** (`DATABASE_URL`) |
| Local infra | Docker Compose: Postgres 16, Redis 7, MinIO |
| Auth (staff) | Cookie `tms_session`, scrypt passwords, Google/Microsoft OAuth |
| Auth (portal) | Cookie `tms_portal_session`, invites + magic links |
| Billing | Stripe seat subscriptions ($25/seat/month) |
| Maps / Places | Google Places, Geocoding, Routes APIs + Leaflet |
| Carrier lookup | FMCSA QCMobile API |
| Fuel index | EIA weekly on-highway diesel |
| Email | Resend (system mail) + per-user Gmail/Outlook OAuth |
| Accounting sync | QuickBooks Online API + QuickBooks Desktop IIF export |
| Object storage | S3-compatible (R2/S3/MinIO/Spaces) with local `UPLOAD_DIR` fallback |
| Cache / rate limits | Optional Redis (`REDIS_URL`); in-memory fallback |
| Background work | Postgres `BackgroundJob` table + `npm run worker` |
| Charts / PDF | Recharts, jsPDF (+ autoTable), VICS-style BOL PDF |
| Process manager (prod) | PM2 at `/var/www/tms` |

**Request gating:** `proxy.ts` redirects unauthenticated staff to `/login`, with public exceptions for auth flows, Stripe webhook, deploy hooks, and the entire `/portal` + `/api/portal` tree (portal enforces its own session).

**Server actions:** Most mutations live under `lib/*-actions.ts` and `lib/actions.ts` (`"use server"`).

---

## Local Setup

1. Install Node.js (LTS recommended).
2. Start local infra:

```bash
docker compose up -d
```

3. Copy env and fill keys:

```bash
cp .env.example .env
```

Defaults point at local Postgres from Compose (`postgresql://tms:tms@localhost:5432/tms`).

4. Install, migrate, and seed:

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

6. Open http://localhost:3000.

For cutover from a legacy SQLite file or local uploads tree, see `scripts/migrate-sqlite-to-postgres.ts` and `scripts/migrate-uploads-to-s3.ts`.

---

## Environment Variables

See `.env.example` for the full list. Summary:

### Core

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL URL (migrations + default client) |
| `DATABASE_POOL_URL` | Optional pooled URL for the app (PgBouncer / Neon) |
| `DATABASE_MIGRATE_URL` | Optional distinct migrate URL when the app uses a pooler |
| `UPLOAD_DIR` | Local document fallback directory |
| `APP_BASE_URL` | Public app URL (password reset, invites, Stripe, OAuth redirects) |
| `COOKIE_SECURE` | Force secure cookies (`true`/`false`); production HTTPS defaults secure |

### Object storage (optional)

| Variable | Purpose |
|----------|---------|
| `S3_BUCKET` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | Enable S3-compatible document/logo storage |
| `S3_ENDPOINT` / `S3_REGION` / `S3_PREFIX` | Endpoint (R2/MinIO/Spaces), region (`auto`), key prefix |

### Redis & worker (optional)

| Variable | Purpose |
|----------|---------|
| `REDIS_URL` | Shared rate limits / cache across instances |
| `JOB_WORKER_POLL_MS` | Background worker poll interval (default `2000`) |

### System email (password reset)

| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY` / `RESEND_FROM` | Preferred outbound mail via Resend |
| `SMTP_*` | Optional SMTP fallback |

### Google Maps / Places

| Variable | Purpose |
|----------|---------|
| `GOOGLE_PLACES_API_KEY` | Business search, address autocomplete, geocode, route miles |

Enable Places API (New), Geocoding API, and Routes API on the Google Cloud project.

### Carrier & fuel data

| Variable | Purpose |
|----------|---------|
| `FMCSA_WEB_KEY` | MC/DOT carrier lookup autocomplete |
| `EIA_API_KEY` | Dashboard Current Fuel Index |

### Stripe seats

| Variable | Purpose |
|----------|---------|
| `STRIPE_SECRET_KEY` | Server Stripe API |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Client publishable key |
| `STRIPE_SEAT_PRICE_ID` | Recurring per-seat price |
| `STRIPE_DEV_PROMO_CODE` | Optional checkout promo (e.g. `tms100`) |

Details: [`docs/STRIPE_SETUP.md`](./STRIPE_SETUP.md).

### QuickBooks

| Variable | Purpose |
|----------|---------|
| `INTUIT_CLIENT_ID` / `INTUIT_CLIENT_SECRET` | Intuit OAuth app |
| `INTUIT_ENVIRONMENT` | `sandbox` or production |
| `INTUIT_REDIRECT_URI` | Optional; derived from `APP_BASE_URL` if unset |
| `INTUIT_TOKEN_ENCRYPTION_KEY` or `TOKEN_ENCRYPTION_KEY` | AES-256-GCM for stored OAuth tokens |

Redirect: `{APP_BASE_URL}/api/integrations/quickbooks/callback`.

### Google OAuth (identity + Gmail)

| Variable | Purpose |
|----------|---------|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth client |
| `GOOGLE_REDIRECT_URI` / `GOOGLE_MAIL_REDIRECT_URI` | Optional overrides |

Redirects:

- `{APP_BASE_URL}/api/auth/oauth/google/callback`
- `{APP_BASE_URL}/api/mail/oauth/google/callback`

### Microsoft OAuth (identity + Outlook)

| Variable | Purpose |
|----------|---------|
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` | Entra app |
| `MICROSOFT_TENANT_ID` | Default `common` |
| `MICROSOFT_*_REDIRECT_URI` | Optional overrides |

Delegated scopes used: `openid`, `profile`, `email`, `User.Read`, `Mail.Send`, `Mail.Read`, `offline_access`.

### Optional

| Variable | Purpose |
|----------|---------|
| `OAUTH_STATE_SECRET` | HMAC for OAuth state cookies (falls back to token encryption key) |

---

## Authentication & Access Control

### Staff login methods

- Email + password
- Google sign-in
- Microsoft 365 sign-in
- Invite accept (password and/or OAuth)
- Company registration (creates workspace + owner)

### Staff session model

- HttpOnly cookie `tms_session` (7-day sessions)
- Session bound to a specific `CompanyMembership`
- Multi-org users can switch organizations
- Forced password change via `mustChangePassword`
- Account lock / disable managed in Admin
- Password reset via email token (Resend)

### Roles

| Role | Capabilities |
|------|----------------|
| `OWNER` | Full admin, billing, user/branch management, write |
| `ADMIN` | Same operational admin as owner (seat/billing admin) |
| `BROKER` | Full operational write within seat + branch scope |
| `DISPATCHER` | Operational write within scope |
| `ACCOUNTING` | Write + commission settle |
| `VIEWER` | Read-only (`canWrite` is false) |

### Permission helpers

- `requireUser` / `requireTmsAccess` / `requireAdmin` / `requireWriteUser`
- Seat gate: operational TMS pages require an assigned seat
- Branch scope: non-admins limited to assigned branches
- Commission settle: OWNER, ADMIN, ACCOUNTING

Portal auth is separate — see [Customer Portal](#customer-portal).

---

## Multi-Tenancy, Branches & Seats

### Organizations (companies)

- Each brokerage is a `Company` with slug, branding, load-number prefix/sequence
- Optional `customerPaymentUrl` for portal invoice Pay CTAs
- Users belong via `CompanyMembership` (role, status, seat, branches)
- Registration creates a company workspace with starter integration placeholders and catalogs

### Branches

- Companies can have multiple branches
- Members can be assigned one or more branches
- Header branch switcher filters list data for multi-branch users/admins
- Loads, customers, carriers, facilities can be branch-scoped

### Seat billing (Stripe)

- Seats purchased per organization at **$25/seat/month**
- Stored on `SeatSubscription` (`seatQuantity`, Stripe IDs, status, period end)
- Admins assign/unassign seats in Admin
- Operational pages require `seatAssignedAt`
- Owners/admins can still reach Admin and Billing without a seat
- Invite accept auto-assigns a seat when one is available
- Webhook: `/api/stripe/webhook`

---

## Feature Catalog

### Dashboard (`/`)

Configurable tile board with:

- Active loads, booked revenue/margin, open AR, carrier/customer counts
- **Current Fuel Index** (EIA diesel series + Recharts)
- Load board snapshot
- Recent check calls

### Loads (`/loads`, `/loads/new`, `/loads/[id]`)

- Create/edit loads with customer, equipment, reefer temp, commodity, weight, lane, dates
- Auto load numbers (`loadNumberPrefix` + sequence, e.g. `GLB-1001`)
- Status workflow: `QUOTE` → `AVAILABLE` → `COVERED` → `DISPATCHED` → `PICKED_UP` → `DELIVERED` → `INVOICED` → `PAID` (or `CANCELED`)
- **Editable load details** after create
- **Clone load** — dialog chooses whether to keep carrier, rate, commodity lines, public notes; appointment dates cleared; private notes / docs / invoices not copied
- **Freight line items** (`LoadCommodityLine`: qty, description, weight, pieces, dimensions)
- **Multi-stop lanes** (`LoadStop`: pickup/delivery sequences, facilities, appointments, geocode cache)
- Charges (`LoadCharge`) and expenses (`LoadExpense`: lumper, detention, TONU, other)
- **Late fees** may be added as `LoadCharge` rows with type `"Late Fee"` when overdue invoices are emailed
- Carrier assignment with driver/truck/trailer and **carrier pay lines** (flat / per mile / hourly / accessorials)
- Check calls with next-check scheduling (geocoded when possible for portal map)
- Public vs private notes; activity log
- Customer/load **rate confirmation terms**
- Route map: Google Routes + state mileage breakdown (Turf + US states GeoJSON) + Leaflet
- Document generate/upload and email actions on the load
- Commission panel (profile, settle, expenses)
- Accounting links (invoice / carrier bill) and QuickBooks push hooks
- Delete load

### Search & Reports (`/search`; `/reports` redirects here)

- Flexible load filters (customer, commodity, status, dates, lane, etc.)
- Results table and clickable rows
- Revenue view: load profitability, lane summary, customer volume
- Export helpers for load/revenue reports

### Dispatch (`/dispatch`)

- Configurable dispatch board (tile layouts)
- Carrier coverage, uncovered freight, assignment-oriented workflow

### Customers (`/customers`, `/customers/[id]`)

- CRM: status, credit limit, payment terms, **late fee percent**, industry, address/contacts
- Default rate confirmation terms
- Activity log and notes
- Linked documents, facilities, loads, invoices
- Google business search for company enrichment
- Branch assignment
- **Portal access** tile: invite portal users, create/revoke magic links, payment URL override

### Carriers (`/carriers`, `/carriers/[id]`)

- CRM: MC/DOT (normalized indexes), equipment, safety rating, compliance status
- Insurance expiration and per-coverage records (auto, cargo, GL, workers comp, etc.)
- Compliance documents, contacts, factoring company link
- FMCSA MC/DOT lookup autocomplete
- Activity log, documents, load/assignment history

### Locations / Facilities (`/locations`)

- Shipper/consignee/distribution center/port/rail facilities
- Address autocomplete; attach to customers; used as load stops

### Documents (`/documents`, `/documents/new`, `/documents/[id]`)

Types include: BOL, POD, RATE_CONFIRMATION, CUSTOMER_LOAD_CONFIRMATION, INVOICE, CARRIER_PACKET, W9, INSURANCE, NOA, BROKER_CONTRACT, and others.

Capabilities:

- Upload files to S3 (when configured) or `UPLOAD_DIR`
- Multi-type tagging, attach to load/customer/carrier/company
- Generate printable HTML / PDF documents (rate con, load con, BOL including VICS-style PDF, invoice)
- Async PDF generation via background jobs when queued
- Print / Save PDF from browser
- Serve files via `/api/documents/[id]/file`

### Accounting (`/accounting`, bills subroutes)

Tabs:

1. **Invoices** — create from loads, statuses (draft/sent/partial/paid/overdue/void), balances, bulk email, bulk QuickBooks push
2. **Bills** — carrier bills with factoring payee snapshot, payment terms, remit address; create/edit flows
3. **AR/AP Report** — aging report

Also:

- AR receipts and AP disbursements with payment applications
- Factoring companies as AP payees
- Overdue status recompute
- **Late fees on invoice email send** — percent of original (non–late-fee) charges per overdue terms period; excluded from commissionable revenue
- QuickBooks Online sync and IIF export status per entity

Admin accounting settings: `/admin/accounting` (method ONLINE | IIF | NONE, account/item config).

### Commissions (`/commissions`, `/commissions/profiles`)

- Profiles with branch/company share % and company minimum expense floor
- Methods: standard split, expense floor, ineligible, no profit
- Per-load commission records: pending → payable → settled
- Settle by load or branch batch (accounting/admin roles)
- Branch default profile assignment
- Late fees excluded from commissionable revenue

### Admin (`/admin`)

- Invite / create users, resend/cancel invites
- Roles, lock, disable, force password change, password reset
- Seat assign/unassign and usage summary
- Multi-branch user assignment
- Create/delete branches
- Company branding (logo, address, phone, email, website, customer payment URL)
- Load number prefix/sequence settings
- Commodity catalog and carrier pay line type catalog
- Factoring companies admin
- Audit log

Related:

- `/admin/billing` — Stripe seat checkout and customer portal
- `/admin/accounting` — QuickBooks method and connection

### Integrations (`/integrations`)

Provider tiles (many still placeholders):

| Provider | Status in product |
|----------|-------------------|
| DAT | Placeholder capabilities |
| Truckstop | Placeholder |
| QuickBooks | Implemented (Online + IIF); configure under Admin Accounting |
| Trucker Tools / tracking | Placeholder |
| ELD | Placeholder notes |
| Factoring | Placeholder (internal factoring CRM exists) |
| Email | Ops via per-user mailbox, not this tile |

### Email settings (`/settings/email`)

- Connect Gmail or Microsoft 365 mailbox per user
- Disconnect / sync
- Used from loads to email: rate confirmation, customer load confirmation, invoice, BOL, POD request
- Reply threads stored as `EmailThread` / `EmailMessage` and syncable per load

### Other auth/utility pages

| Path | Purpose |
|------|---------|
| `/login` | Password + OAuth |
| `/register` | New company workspace |
| `/accept-invite` | Staff invite onboarding |
| `/forgot-password` / `/reset-password` | Reset flow |
| `/change-password` | Forced or voluntary change |
| `/select-organization` | Org picker / seat messaging |
| `/logout` | End session |
| `/privacy` / `/terms` | Legal |

---

## Customer Portal

Separate surface under `/portal/*` with its own session cookie and UI shell (`components/customer-portal-shell.tsx`). Brokers manage access from the customer detail **Portal access** tile.

### Access modes

| Mode | Entry | Session |
|------|-------|---------|
| Invited user | Email invite → `/portal/accept-invite` → set password | 7-day `tms_portal_session` |
| Password login | `/portal/login` | 7-day user session |
| Magic / share link | `/portal/access` or `/portal/access/[token]` | ≤24 hours, capped by link expiry |

Tokens are stored hashed (SHA-256). Portal user statuses: `INVITED` → `ACTIVE` / `DISABLED`. Share links default to ~30 days (max 365) and are revocable.

### Portal routes

| Path | Purpose |
|------|---------|
| `/portal` | Overview: metrics + load map + board preview |
| `/portal/board` | Full filtered customer dispatch board |
| `/portal/loads/[id]` | Customer-safe load detail |
| `/portal/invoices` | Non-void invoices for that customer |
| `/portal/invoices/[id]` | Invoice detail, docs, optional Pay CTA |
| `/portal/login` | Email/password |
| `/portal/accept-invite` | Activate invite |
| `/portal/access`, `/portal/access/[token]` | Redeem magic link |

### Customer-safe data rules

- Scoped always to the signed-in `customerId`
- Documents shown: BOL, POD, CUSTOMER_LOAD_CONFIRMATION, INVOICE
- Pay URL: `Customer.paymentUrl ?? Company.customerPaymentUrl`
- **Never** expose carrier pay, margin, commissions, or private notes
- Map pins: pickup → geocoded check calls → snap to delivery on `DELIVERED+`; hide `CANCELED` / `INVOICED` / `PAID` from the map
- Late fees are not shown as a separate portal UI; they inflate invoice totals when applied

Planning notes (many items now shipped): [`customer-portal-dashboard-plan.md`](./customer-portal-dashboard-plan.md).

---

## API Routes

| Route | Purpose |
|-------|---------|
| `GET/POST` `/api/auth/session` | Session heartbeat / session helpers |
| `/api/auth/oauth/[provider]/start` | Google/Microsoft identity OAuth start |
| `/api/auth/oauth/[provider]/callback` | Identity OAuth callback |
| `/api/mail/oauth/[provider]/start` | Mailbox connect start |
| `/api/mail/oauth/[provider]/callback` | Mailbox connect callback |
| `/api/mail/sync` | Mailbox sync |
| `/api/stripe/webhook` | Seat subscription events |
| `/api/integrations/quickbooks/connect` | Start QBO OAuth |
| `/api/integrations/quickbooks/callback` | QBO OAuth callback |
| `/api/integrations/quickbooks-desktop/export` | IIF export download |
| `/api/company/logo` | Company logo file (staff) |
| `/api/carriers/lookup` | FMCSA MC/DOT lookup |
| `/api/business-search` | Google business search |
| `/api/loads/[id]/route` | Compute/cache driving route + state miles |
| `/api/documents/[id]/file` | Serve uploaded/generated document bytes (staff) |
| `/api/ui-layout` | Persist drag-resize tile layouts |
| `/api/portal/company-logo` | Company logo for portal shell |
| `/api/portal/documents/[id]/file` | Customer-facing document download |

---

## Integrations

### Implemented

1. **Stripe** — seat checkout, portal, webhooks, seat quantity sync  
2. **QuickBooks Online** — connect, push invoices/bills, payment reconcile, encrypted tokens  
3. **QuickBooks Desktop (IIF)** — generate/export IIF; independent export history per method  
4. **Google / Microsoft identity** — login, register, invite accept  
5. **Gmail / Outlook mail** — send ops emails + inbound reply sync  
6. **Google Places / Geocoding / Routes** — addresses, routing, maps  
7. **FMCSA QCMobile** — carrier MC/DOT autocomplete  
8. **EIA** — diesel fuel index on dashboard  
9. **Resend / SMTP** — system password-reset email  
10. **Ascend CSV import** — `npm run db:import-ascend` (+ prod helper script)  
11. **S3-compatible storage** — documents/logos when `S3_*` is set  
12. **Redis** — optional shared rate limits and cache  

### Token security

OAuth tokens for QuickBooks and mailboxes are encrypted at rest (AES-256-GCM) using `TOKEN_ENCRYPTION_KEY` or `INTUIT_TOKEN_ENCRYPTION_KEY`.

---

## Database Model Summary

Primary Prisma models (PostgreSQL):

**Tenancy / access:** `Company`, `Branch`, `User`, `CompanyMembership`, `MembershipBranch`, `Session`, `SeatSubscription`, `OAuthAccount`, `AuditLog`

**Customer portal:** `CustomerPortalUser`, `CustomerPortalLink`, `CustomerPortalSession`  
Also: `Company.customerPaymentUrl`, `Customer.paymentUrl`, `Customer.lateFeePercent`

**Network:** `Customer`, `CustomerContact`, `CustomerActivity`, `Carrier`, `CarrierContact`, `CarrierActivity`, `CarrierComplianceDocument`, `CarrierInsuranceCoverage`, `Facility`, `FactoringCompany`

**Operations:** `Load`, `LoadStop`, `LoadCommodityLine`, `LoadCharge`, `LoadExpense`, `DispatchAssignment`, `CarrierPayLine`, `CarrierPayLineType`, `CheckCall`, `LoadNote`, `LoadActivity`, `CommodityOption`  
Geocode cache: `LoadStop` / `CheckCall` `latitude`, `longitude`, `geocodedAt`

**Documents / mail:** `LoadDocument`, `UserMailbox`, `EmailThread`, `EmailMessage`

**Money:** `Invoice`, `CarrierBill`, `Payment`, `PaymentApplication`, `CommissionProfile`, `CommissionProfileRule`, `LoadCommission`

**Integrations / jobs:** `IntegrationAccount`, `AccountingExport`, `BackgroundJob`

Schema file: `prisma/schema.prisma`.  
Migrations: `prisma/migrations/` (Postgres init, customer portal, late fee percent).

---

## UI System

- Shared staff shell: `components/app-shell.tsx` (grouped nav flyouts, org switcher, branch switcher, mobile menu, session heartbeat)
- Portal shell: `components/customer-portal-shell.tsx` (Overview / Board / Invoices)
- **TileBoard**: draggable/resizable page tiles with per-user layouts (`uiPreferences` JSON)
- Sortable tables + client/server pagination
- Status badges, metric cards, search comboboxes, print button

Nav groups (staff):

1. **Operations** — Dashboard, Loads, Search, Dispatch  
2. **Network** — Customers, Carriers, Locations  
3. **Records** — Documents, Accounting, Commissions, Reports  
4. **Admin** — Admin, Accounting Settings, Billing, Integrations, Email settings  

---

## Background Jobs, Redis & Storage

### Document storage (`lib/document-storage.ts`)

- S3 mode when `S3_BUCKET` + access key + secret are set
- Otherwise writes under `UPLOAD_DIR` (default `./uploads`)
- Keys/paths: `{companyId}/{hex}-{filename}`; 25 MB; PDF/JPEG/PNG/WebP

### Redis (`lib/redis.ts`)

- Optional `REDIS_URL`
- Used by rate limiting (`lib/rate-limit.ts`) and cache (`lib/cache.ts`)
- In-memory fallback when Redis is unset or unavailable

### Background jobs (`lib/jobs.ts`, `scripts/job-worker.ts`)

Postgres-backed queue with `FOR UPDATE SKIP LOCKED` claiming:

| Job type | Purpose |
|----------|---------|
| `GENERATE_PDF` | Render/persist PDF onto a `LoadDocument` |
| `SYNC_MAILBOX` | Sync user mailbox threads |

Statuses: `PENDING` → `RUNNING` → `COMPLETED` / retry / `FAILED` (default max 5 attempts).  
Run with `npm run worker` (or `scripts/tms-worker.sh` in prod layouts).

---

## Production Deploy

Production: **https://tms.simple-source.com**

### Automatic path (preferred)

1. Push to `origin` **`main`**.
2. GitHub Actions workflow `.github/workflows/deploy.yml` POSTs a signed webhook to  
   `https://tms.simple-source.com/hooks/tms-deploy`.
3. Server runs `scripts/tms-deploy.sh` (flock-serialized):

   - `git fetch` + `git reset --hard origin/main`
   - `chmod +x` deploy/worker scripts (preserve executable bit)
   - `npm ci --include=dev`
   - `prisma generate`
   - `prisma migrate deploy` (uses `DATABASE_MIGRATE_URL` when set)
   - production `next build` with raised Node heap (`4096` MB)
   - `pm2 reload` (or start) app `tms` and worker `tms-worker`

Do **not** also configure a GitHub repo webhook if Actions is already deployed (would double-deploy).

Secret: repo Action secret `DEPLOY_WEBHOOK_SECRET` must match `/etc/webhook.conf` on the server.

Full notes: [`scripts/setup-auto-deploy.md`](../scripts/setup-auto-deploy.md).  
Agent rule: [`.cursor/rules/deploy-production.mdc`](../.cursor/rules/deploy-production.mdc).

### Verify

- GitHub → Actions → **Deploy** (green)
- Or SSH (ops/debug only): `ssh tms "tail -n 40 /var/log/tms-deploy.log"`

### Server files of interest

| Path | Purpose |
|------|---------|
| `/var/www/tms` | App checkout |
| `/var/www/tms/scripts/tms-deploy.sh` | Deploy script |
| `/var/log/tms-deploy.log` | Deploy log |
| `/etc/nginx/sites-available/tms.simple-source.com` | Reverse proxy |
| nginx conf copies in `scripts/` | Reference SSL/site configs |

---

## Useful Commands & Scripts

```bash
npm run dev              # prisma generate + migrate deploy + next dev
npm run build            # prisma generate + next build
npm run start            # next start
npm run worker           # background job worker
npm run lint             # eslint, zero warnings allowed
npm run test             # tsx --test for lib/**/*.test.ts
npm run setup            # generate + migrate deploy + seed
npm run db:migrate       # prisma migrate deploy
npm run db:migrate:dev   # prisma migrate dev
npm run db:seed          # seed demo data
npm run db:reset         # migrate reset + seed
npm run db:import-ascend # import Ascend CSV loads
npm run db:backfill-facilities
```

Other repo scripts:

| Script | Purpose |
|--------|---------|
| `scripts/tms-deploy.sh` | Production deploy |
| `scripts/tms-worker.sh` | Worker process helper |
| `scripts/job-worker.ts` | Job worker entrypoint |
| `scripts/prod-inspect.sh` | Prod git/DB sanity checks |
| `scripts/prod-import-ascend.sh` | Stop PM2, import Ascend CSV, restart |
| `scripts/migrate-sqlite-to-postgres.ts` | Legacy SQLite cutover |
| `scripts/migrate-uploads-to-s3.ts` | Upload tree → S3 |
| `prisma/backfill-*.ts` | One-off data backfills |
| `prisma/migrate-to-memberships.ts` | Membership migration helper |

---

## Demo Seed Data

After `npm run setup` / `npm run db:seed`:

| Account | Email | Password |
|---------|-------|----------|
| Owner | `owner@example.com` | `ChangeMe123!` |
| Dispatcher | `dispatch@example.com` | `ChangeMe123!` (forced password change) |

Company: **Great Lakes Brokerage** (`GLB` load prefix).

Sample loads:

- `GLB-1001` — covered/dispatch demo (carrier, check call, docs, invoice, bill)
- `GLB-1002` — available freight needing coverage

Demo PDF files may be written under `uploads/demo/` when using local storage.

---

## Known Placeholders / Next Steps

Already useful as-is for brokerage ops; still intentional gaps:

- DAT / Truckstop / ELD / Trucker Tools tiles are capability placeholders
- Portal Pay CTA is remittance-URL based; Stripe Connect AR capture is out of scope for now
- MFA before handling highly sensitive broker data at scale
- Tracking/document-capture providers for automated check calls and POD
- Legacy SQLite + local-only-upload docs remain only as cutover scripts, not the primary stack

---

## Directory Map (high level)

```text
app/                 Next.js App Router pages (broker + portal) + API routes
components/          UI components (boards, tables, forms, maps, shells)
lib/                 Auth, actions, search, QuickBooks, mail, portal, commissions, jobs, storage
prisma/              schema.prisma, migrations, seed, import/backfill scripts
docs/                System description, this overview, Stripe setup, portal plan
scripts/             Deploy, worker, nginx refs, cutover helpers
public/geo/          US states GeoJSON for route state miles
.github/workflows/   Deploy on push to main
.cursor/rules/       Agent guidance (e.g. production deploy)
```

---

*Generated from a full codebase review at release 0.4.4 (PostgreSQL, customer portal, late fees, clone load, S3/Redis/worker stack).*
