# Freight Broker TMS — Complete Project Review

**Version:** 0.4.4  
**Production:** https://tms.simple-source.com  
**Repository:** `caninegamingllc/tms`  
**Reviewed:** full application tree (`app/`, `components/`, `lib/`, `prisma/`, `scripts/`, deploy tooling) at the 0.4.4 codebase state.

This document is the single collective review of the project: what it is, who uses it, how it is built, what every major area does, how data and auth are modeled, and how it runs in production.

---

## 1. Executive summary

**Freight Broker TMS** is a multi-tenant transportation management system for freight brokerages. Workflows are AscendTMS-inspired. One Next.js application delivers:

1. A **broker operations console** for seated brokerage staff (loads, CRM, dispatch, documents, AR/AP, commissions, email ops, admin).
2. A separate **customer portal** (`/portal`) for shippers to track their loads on a map/board and review invoices.
3. Shared tenancy, Stripe seat billing, integrations, and background processing behind both surfaces.

Each brokerage is an isolated `Company` workspace. Staff join via `CompanyMembership` with a role and optional branch scope. Operational TMS access requires an assigned **Stripe seat** ($25/seat/month). Customers never share staff sessions; they use a distinct portal cookie and a customer-scoped, whitelisted data model (no carrier pay, margin, commissions, or private notes).

| Attribute | Value |
|-----------|--------|
| App version | `0.4.4` (`package.json`) |
| Framework | Next.js App Router, React, TypeScript, Tailwind |
| Database | **PostgreSQL** via Prisma 6 (migrations in `prisma/migrations`) |
| Local infra | Docker Compose: Postgres 16, Redis 7, MinIO |
| Staff auth cookie | `tms_session` |
| Portal auth cookie | `tms_portal_session` |
| Billing | Stripe seats |
| Process manager (prod) | PM2 (`tms` app + `tms-worker`) |
| Deploy trigger | Push to `main` → GitHub Actions → production webhook |

**Scale of the codebase (approx.):** ~250 TypeScript/TSX/SQL/shell source files under `app`, `components`, `lib`, `prisma`, `scripts`; ~40 App Router pages; ~18 API routes; 50+ Prisma models; extensive server-action modules in `lib/`.

---

## 2. What problem the product solves

A freight brokerage needs one system of record to:

- Book and lifecycle-manage loads (quote → cover → dispatch → deliver → invoice → pay).
- Maintain customer and carrier networks (credit, terms, compliance, insurance, factoring).
- Cover freight on a dispatch board and record check calls.
- Generate and email rate confirmations, load confirmations, BOLs, invoices, POD requests.
- Track AR (customer invoices) and AP (carrier bills), including aging and QuickBooks export.
- Settle broker commissions against profiles and branch rules.
- Let customers self-serve load status and invoices without seeing broker economics.
- Administer users, branches, seats, branding, and catalogs per organization.

This app implements that loop as a SaaS-style multi-tenant web product rather than a single-broker desktop tool.

---

## 3. Who uses it

| Audience | Entry | Capabilities |
|----------|-------|----------------|
| Brokers / dispatchers | Staff login | Create/edit loads, assign carriers, check calls, documents, CRM write |
| Accounting | Staff login | Invoices, bills, AR/AP, commission settle |
| Owners / admins | Staff login | Users, invites, seats/billing, branches, catalogs, audit, integrations, branding |
| Viewers | Staff login | Read-only operational views |
| Customer contacts | Portal invite, password login, or magic link | Read-only loads/map/board/invoices/docs for *their* customer record |

---

## 4. Architecture overview

```text
                         ┌─────────────────────────────┐
                         │         Browsers            │
                         │  Broker UI  │  Portal UI    │
                         └──────┬──────┴───────┬───────┘
                                │              │
                         tms_session    tms_portal_session
                                │              │
                         ┌──────▼──────────────▼───────┐
                         │   Next.js (App Router)      │
                         │   proxy.ts public gating    │
                         │   Server Components +       │
                         │   "use server" actions      │
                         │   Route Handlers (api/*)    │
                         └──────┬──────────────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          │                     │                     │
          ▼                     ▼                     ▼
   PostgreSQL              Redis (opt)          S3 / local disk
   Prisma models           rate limit/cache     documents & logos
   BackgroundJob queue
          ▲
          │ claim FOR UPDATE SKIP LOCKED
          ▼
   npm run worker
   GENERATE_PDF · SYNC_MAILBOX
```

**Design pattern:** almost all mutations are server actions (`lib/*-actions.ts`, `lib/actions.ts`). Pages are largely server-rendered with client components for boards, tables, maps, and editors. Request gating for staff sessions lives in `proxy.ts`; portal routes are public to staff middleware and enforce portal auth themselves.

---

## 5. Technology stack

| Layer | Choice |
|-------|--------|
| UI | React, Tailwind, Lucide icons, Recharts, Leaflet / react-leaflet |
| App framework | Next.js (App Router), TypeScript |
| Validation / utils | Zod, clsx |
| ORM | Prisma 6 (`provider = "postgresql"`) |
| Database | PostgreSQL 16 |
| Optional cache | Redis 7 (`REDIS_URL`; in-memory fallback) |
| Object storage | `@aws-sdk/client-s3` (R2 / S3 / MinIO / Spaces) or `UPLOAD_DIR` |
| PDF | jsPDF, jspdf-autotable, custom VICS-style BOL |
| Geo | Google Places / Geocoding / Routes; `@turf/turf`; US states GeoJSON |
| Auth crypto | scrypt passwords; SHA-256 hashed tokens; AES-256-GCM OAuth token encryption |
| Email | Resend API (preferred) or SMTP; Gmail/Outlook OAuth mailboxes for ops |
| Billing | Stripe |
| Accounting sync | QuickBooks Online API + IIF text export for Desktop |
| Carrier registry | FMCSA QCMobile |
| Fuel index | EIA Open Data |
| Tests | `tsx --test` (e.g. `lib/late-fees.test.ts`) |
| Lint | ESLint (`--max-warnings=0`) |

---

## 6. Local development & environment

### Bootstrap

```bash
docker compose up -d          # Postgres + Redis + MinIO
cp .env.example .env
npm install
npm run setup                 # prisma generate + migrate deploy + seed
npm run dev                   # web
npm run worker                # optional PDF/mail jobs
```

Open http://localhost:3000.

### Seed accounts

| Role | Email | Password |
|------|-------|----------|
| Owner | `owner@example.com` | `ChangeMe123!` |
| Dispatcher | `dispatch@example.com` | `ChangeMe123!` (forced password change) |

Demo company: **Great Lakes Brokerage** (`GLB` load prefix). Sample loads `GLB-1001` (covered demo) and `GLB-1002` (available freight).

### Important environment groups

| Group | Keys (representative) |
|-------|------------------------|
| Database | `DATABASE_URL`, optional `DATABASE_POOL_URL`, `DATABASE_MIGRATE_URL` |
| Storage | `UPLOAD_DIR`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT`, `S3_REGION`, `S3_PREFIX` |
| Runtime | `APP_BASE_URL`, `COOKIE_SECURE`, `REDIS_URL`, `JOB_WORKER_POLL_MS` |
| System mail | `RESEND_API_KEY`, `RESEND_FROM`, optional `SMTP_*` |
| Maps / carriers / fuel | `GOOGLE_PLACES_API_KEY`, `FMCSA_WEB_KEY`, `EIA_API_KEY` |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SEAT_PRICE_ID`, `STRIPE_DEV_PROMO_CODE` |
| QuickBooks | `INTUIT_CLIENT_ID`, `INTUIT_CLIENT_SECRET`, `INTUIT_ENVIRONMENT`, token encryption key |
| OAuth identity + mail | `GOOGLE_*`, `MICROSOFT_*`, `OAUTH_STATE_SECRET` / `TOKEN_ENCRYPTION_KEY` |

Full comments live in `.env.example`. Stripe setup notes: `docs/STRIPE_SETUP.md`.

---

## 7. Authentication, roles, tenancy, seats

### Staff authentication

- Email/password (scrypt), Google OAuth, Microsoft 365 OAuth.
- Company registration creates workspace + OWNER.
- Staff invites (password and/or OAuth accept).
- Password reset via Resend/SMTP token email.
- Forced password change (`mustChangePassword`).
- Admin lock / disable membership states.
- Legal acceptance fields on `User` (`legalAcceptedAt`, `legalDocumentVersion`).

Session: HttpOnly `tms_session` (~7 days), bound to a specific `CompanyMembership`. Multi-org users use the org switcher / `/select-organization`.

### Roles (`lib/constants.ts`, `lib/scope.ts`)

| Role | Write | Settle commissions | Manage users / billing admin |
|------|-------|--------------------|------------------------------|
| `OWNER` | Yes | Yes | Yes |
| `ADMIN` | Yes | Yes | Yes |
| `BROKER` | Yes | No | No |
| `DISPATCHER` | Yes | No | No |
| `ACCOUNTING` | Yes | Yes | No |
| `VIEWER` | No | No | No |

Helpers: `requireUser`, `requireTmsAccess`, `requireWriteUser`, `canWrite`, `canManageUsers`, seat checks via `lib/seats.ts`.

### Branches

`Branch` records per company. Members get zero or more branches through `MembershipBranch`. Non-admins are limited to assigned branch data. Admins/owners can use the header branch switcher as a filter over all company data.

### Seats (Stripe)

- `SeatSubscription` stores quantity and Stripe IDs/status.
- Memberships need `seatAssignedAt` to use operational TMS pages.
- Owners/admins without a seat can still reach Admin / Billing (`/admin/billing?needsSeat=1`).
- Invite accept assigns a free seat when available.
- Webhook: `/api/stripe/webhook`.

### Portal authentication (separate)

- Cookie `tms_portal_session`.
- Models: `CustomerPortalUser`, `CustomerPortalLink`, `CustomerPortalSession`.
- Modes: invited password user (7-day session) or magic/share link (≤24h, capped by link expiry).
- Tokens stored as SHA-256 hashes.
- Portal users are not staff seats and do not inherit branch/role scope; they are bound to one `customerId`.

### `proxy.ts` public paths

Staff middleware does **not** require `tms_session` for:

`/login`, `/register`, `/change-password`, `/accept-invite`, `/forgot-password`, `/reset-password`, `/privacy`, `/terms`, `/hooks`, `/portal`, `/api/auth/oauth`, `/api/stripe/webhook`, `/api/portal`.

Everything else redirects to `/login?next=…` without a staff session.

---

## 8. Broker feature catalog (collective review)

### 8.1 Dashboard (`/`)

Configurable **TileBoard** with per-user layouts (`uiPreferences`):

- Metric cards: active loads, revenue/margin, open AR, customer/carrier counts.
- **Current Fuel Index** (EIA weekly diesel + Recharts) via `lib/eia-diesel.ts` / `components/fuel-index-card.tsx`.
- Load board snapshot and recent check calls.

### 8.2 Loads (`/loads`, `/loads/new`, `/loads/[id]`)

Central system of record.

**Status workflow**

`QUOTE` → `AVAILABLE` → `COVERED` → `DISPATCHED` → `PICKED_UP` → `DELIVERED` → `INVOICED` → `PAID` · or `CANCELED`

**Capability inventory**

- Auto load numbers from company prefix + sequence (e.g. `GLB-1001`).
- Customer, reference #, equipment (`Dry Van`, `Reefer`, `Flatbed`, …), reefer °F, commodity, weight, lane cities/states, pickup/delivery dates.
- Editable details after create (`load-details-editor`).
- **Multi-stop lanes** (`LoadStop`) with facility link, appointments, instructions, lat/lng geocode cache.
- **Freight line items** (`LoadCommodityLine`: qty, description, weight, pieces, dimensions).
- Revenue charges (`LoadCharge`) and expenses (`LoadExpense`: Lumper, Detention, TONU, Other).
- Carrier assignment (`DispatchAssignment`) with driver/truck/trailer.
- **Carrier pay lines** (FLAT / PER_MILE / HOURLY + accessorials from company catalog).
- Check calls with scheduling; geocode on create when possible.
- Public vs private notes; activity history.
- Rate confirmation terms (customer default + load override).
- Route compute/cache: miles, state breakdown (Turf + GeoJSON), polyline (`/api/loads/[id]/route`).
- Document generate/upload + email ops (rate con, load con, invoice, BOL, POD request).
- Commission panel; accounting invoice/bill links; QuickBooks push hooks.
- **Clone load** (`clone-load-button`): optional keep carrier/rate/commodity/public notes; appointments cleared; private notes/docs/invoices not copied.
- Delete load.

Primary logic concentrated in `lib/actions.ts` (large server-actions module), plus `load-search`, `load-stops`, `load-commodity`, `load-route`, `commission`, document and email modules.

### 8.3 Search & reports (`/search`, `/reports`)

- Flexible load search filters and results table.
- Revenue/profitability, lane summary, customer volume views.
- Export helpers in `lib/export-reports.ts`.
- `/reports` effectively routes into the search/reporting experience.

### 8.4 Dispatch (`/dispatch`)

Coverage-oriented board (`dispatch-board`, `dispatch-board.ts`) for uncovered and assigned freight, configurable with the tile layout system.

### 8.5 Customers (`/customers`, `/customers/[id]`)

CRM with:

- Status, credit limit, payment terms, industry, address, contacts.
- **`lateFeePercent`** — percent of original (non–late-fee) invoice amount charged per overdue terms period on invoice email send.
- Default rate confirmation terms.
- Payment URL override (for portal Pay CTA).
- Documents, facilities, loads, invoices, activity.
- Google Places business search enrichment.
- Branch assignment.
- **Portal access tile** — invite users, magic links, revoke/disable.

### 8.6 Carriers (`/carriers`, `/carriers/[id]`)

CRM with:

- MC/DOT (normalized indexes), equipment, safety rating, compliance status.
- Insurance coverages (`AUTO_LIABILITY`, `CARGO`, `GENERAL_LIABILITY`, `WORKERS_COMP`, …).
- Compliance documents, contacts, factoring company link.
- FMCSA QCMobile autocomplete (`/api/carriers/lookup`).
- Load/assignment history and activity.

### 8.7 Locations / facilities (`/locations`)

Facility types: `GENERAL`, `SHIPPER`, `CONSIGNEE`, `DISTRIBUTION_CENTER`, `PORT`, `RAIL`. Address autocomplete; attachable to customers; used as load stops.

### 8.8 Documents (`/documents`, `/documents/new`, `/documents/[id]`)

**Types:** BOL, POD, RATE_CONFIRMATION, CUSTOMER_LOAD_CONFIRMATION, INVOICE, CARRIER_PACKET, DOT_MC_FF_URS, NOA, W9, INSURANCE_PROOF, BROKER_CONTRACT, INSURANCE, OTHER.

**Capabilities**

- Upload (25 MB; PDF/JPEG/PNG/WebP) to S3 or local `UPLOAD_DIR`.
- Attach to load / customer / carrier / company.
- Generate HTML/PDF artifacts (rate con, load con, invoice, VICS-style BOL).
- Async `GENERATE_PDF` background jobs.
- Staff file route `/api/documents/[id]/file`.

Templates live in `lib/document-templates.ts`, `document-html-templates.ts`, `pdf-bol.ts`, `pdf-documents.ts`; storage in `document-storage.ts`.

### 8.9 Accounting (`/accounting`, bills subroutes)

Tabs and flows:

1. **Invoices** — create from loads; statuses DRAFT / SENT / APPROVED / PARTIAL / PAID / OVERDUE / VOID; balances; bulk email; QBO push.
2. **Carrier bills** — payee snapshot (carrier or factoring), remit address, terms; create/edit under `/accounting/bills/*`.
3. **AR/AP aging** — `accounting-aging.ts` / aging report UI.

Also: AR receipts and AP disbursements (`Payment` + `PaymentApplication`), factoring companies as AP payees, overdue recompute.

**Late fees (`lib/late-fees.ts`, `late-fees-apply.ts`)**

- Configured on `Customer.lateFeePercent`.
- Applied when emailing an invoice (`email-ops-actions`); creates stacking `"Late Fee"` / `"Late Fee (2)"` … `LoadCharge` rows.
- Periods based on days past due ÷ payment-terms days; does not compound on prior late fees.
- Increments load revenue and invoice totals/balances; regenerates invoice PDF.
- Excluded from commissionable revenue.

Admin method config at `/admin/accounting`: QuickBooks method `NONE` | `ONLINE` | `IIF`.

### 8.10 Commissions (`/commissions`, `/commissions/profiles`)

- Profiles with branch/company share % and company minimum expense floor.
- Methods: `STANDARD_SPLIT`, `EXPENSE_FLOOR`, `INELIGIBLE`, `NO_PROFIT`.
- Per-load `LoadCommission`: `PENDING` → `PAYABLE` → `SETTLED` (or `INELIGIBLE`).
- Settle by load or branch batch (OWNER / ADMIN / ACCOUNTING).
- Branch default profile assignment.

### 8.11 Admin & settings

| Path | Purpose |
|------|---------|
| `/admin` | Users/invites, roles, lock/disable, seats, branches, branding, load # settings, catalogs, factoring admin, audit log |
| `/admin/billing` | Stripe seat checkout + Stripe customer portal |
| `/admin/accounting` | QBO connection + method/config |
| `/integrations` | Provider tiles (many placeholders; QBO is real via admin accounting) |
| `/settings/email` | Per-user Gmail/Outlook mailbox connect/sync |

### 8.12 Auth/utility pages

`/login`, `/register`, `/accept-invite`, `/forgot-password`, `/reset-password`, `/change-password`, `/select-organization`, `/logout`, `/privacy`, `/terms`.

---

## 9. Customer portal (collective review)

Isolated UI shell (`customer-portal-shell`): Overview · Board · Invoices · Sign out. Managed from customer detail portal access tile.

### Routes

| Path | Purpose |
|------|---------|
| `/portal` | Metrics + interactive load map + board preview |
| `/portal/board` | Full customer dispatch board (no margin/pay columns) |
| `/portal/loads/[id]` | Customer-safe load detail (stops, carrier/driver name, check calls, docs) |
| `/portal/invoices`, `/portal/invoices/[id]` | Invoice list/detail + docs + optional Pay URL |
| `/portal/login` | Password login |
| `/portal/accept-invite` | Invite → set password (≥8 chars) |
| `/portal/access`, `/portal/access/[token]` | Magic/share link redeem → session → `/portal` |

### Portal APIs

- `/api/portal/company-logo`
- `/api/portal/documents/[id]/file` (customer-facing types only)

### Map rules (`lib/customer-load-map.ts`)

1. If status is `DELIVERED` / `INVOICED` / `PAID` → pin snaps to delivery coords.
2. Else latest geocoded check call moves the pin.
3. Else pin starts at pickup.
4. Map hides `CANCELED`, `INVOICED`, and `PAID` loads from the overview map set used in current product behavior.

### Data safety

Visible documents: BOL, POD, CUSTOMER_LOAD_CONFIRMATION, INVOICE.  
Pay URL: `Customer.paymentUrl ?? Company.customerPaymentUrl`.  
Never serialize carrier pay, broker margin, commissions, or private notes.

Core modules: `portal-auth.ts`, `portal-auth-actions.ts`, `portal-admin-actions.ts`, `portal-queries.ts`, `customer-board.ts`, `customer-load-map.ts`.

---

## 10. Page & API inventory

### App Router pages (`page.tsx`)

**Broker / shared**

- `/` dashboard  
- `/loads`, `/loads/new`, `/loads/[id]`  
- `/search`, `/reports`, `/dispatch`  
- `/customers`, `/customers/[id]`  
- `/carriers`, `/carriers/[id]`  
- `/locations`  
- `/documents`, `/documents/new`, `/documents/[id]`  
- `/accounting`, `/accounting/bills/new`, `/accounting/bills/[id]`  
- `/commissions`, `/commissions/profiles`  
- `/admin`, `/admin/billing`, `/admin/accounting`  
- `/integrations`, `/settings/email`  
- Auth/legal: login, register, accept-invite, change/forgot/reset password, select-organization, privacy, terms  

**Portal**

- `/portal`, `/portal/board`, `/portal/loads/[id]`, `/portal/invoices`, `/portal/invoices/[id]`  
- `/portal/login`, `/portal/accept-invite`, `/portal/access`, `/portal/access/[token]`  

### API routes

| Route | Role |
|-------|------|
| `/api/auth/session` | Staff session heartbeat |
| `/api/auth/oauth/[provider]/start\|callback` | Google/Microsoft identity |
| `/api/mail/oauth/[provider]/start\|callback` | Mailbox connect |
| `/api/mail/sync` | Mailbox sync |
| `/api/stripe/webhook` | Seat subscription events |
| `/api/integrations/quickbooks/connect\|callback` | QBO OAuth |
| `/api/integrations/quickbooks-desktop/export` | IIF download |
| `/api/company/logo` | Staff company logo |
| `/api/carriers/lookup` | FMCSA lookup |
| `/api/business-search` | Google business search |
| `/api/loads/[id]/route` | Route + state miles |
| `/api/documents/[id]/file` | Staff document bytes |
| `/api/ui-layout` | Persist tile layouts |
| `/api/portal/company-logo` | Portal logo |
| `/api/portal/documents/[id]/file` | Portal document bytes |

---

## 11. Data model summary

Schema: `prisma/schema.prisma`. Migrations:

1. `20260715000000_init_postgres` — Postgres foundation  
2. `20260715183000_customer_portal` — portal tables, payment URLs, stop/check-call geocode fields  
3. `20260715190000_customer_late_fee_percent` — `Customer.lateFeePercent`

### Domain groups

| Domain | Models |
|--------|--------|
| Tenancy / access | `Company`, `Branch`, `User`, `CompanyMembership`, `MembershipBranch`, `Session`, `SeatSubscription`, `OAuthAccount`, `AuditLog` |
| Portal | `CustomerPortalUser`, `CustomerPortalLink`, `CustomerPortalSession` |
| Network | `Customer`, `CustomerContact`, `CustomerActivity`, `Carrier`, `CarrierContact`, `CarrierActivity`, `CarrierComplianceDocument`, `CarrierInsuranceCoverage`, `Facility`, `FactoringCompany` |
| Ops | `Load`, `LoadStop`, `LoadCommodityLine`, `LoadCharge`, `LoadExpense`, `DispatchAssignment`, `CarrierPayLine`, `CarrierPayLineType`, `CheckCall`, `LoadNote`, `LoadActivity`, `CommodityOption` |
| Docs / mail | `LoadDocument`, `UserMailbox`, `EmailThread`, `EmailMessage` |
| Money | `Invoice`, `CarrierBill`, `Payment`, `PaymentApplication`, `CommissionProfile`, `CommissionProfileRule`, `LoadCommission` |
| Integrations / jobs | `IntegrationAccount`, `AccountingExport`, `BackgroundJob` |

### Notable fields

- `Company`: branding, load number sequence, `quickbooksMethod` / config JSON, `customerPaymentUrl`.
- `Customer`: credit, terms, `lateFeePercent`, `paymentUrl`, rate-con terms, branch.
- `Load`: status, revenue/carrier cost cents, commission flags, cached route miles/polyline/state miles.
- `LoadStop` / `CheckCall`: `latitude`, `longitude`, `geocodedAt`.
- `Invoice` / `CarrierBill`: totals, balances, due dates, external QBO ids.
- `BackgroundJob`: type, payload JSON, status, lock fields, retries (default max 5).

Money is stored in **integer cents**.

---

## 12. Integrations (implemented vs placeholder)

### Implemented

| Integration | Behavior |
|-------------|----------|
| Stripe | Seat checkout, customer portal, webhooks, quantity sync |
| QuickBooks Online | OAuth connect, push invoices/bills, encrypted tokens |
| QuickBooks Desktop | IIF generation/export; independent `AccountingExport` history |
| Google / Microsoft identity | Login, register, invite accept |
| Gmail / Outlook | Ops send + inbound reply sync on loads |
| Google Places / Geocoding / Routes | Business search, addresses, maps, miles |
| FMCSA QCMobile | MC/DOT carrier autocomplete |
| EIA | Dashboard diesel fuel index |
| Resend / SMTP | System password-reset / invite mail |
| Ascend CSV import | `npm run db:import-ascend` (+ prod helper) |
| S3-compatible storage | Documents/logos when `S3_*` configured |
| Redis | Shared rate limits and cache when `REDIS_URL` set |

### Placeholders / future

- DAT, Truckstop, ELD, Trucker Tools tiles on `/integrations`.
- Automated POD/tracking providers.
- Portal Stripe Connect / in-app AR card capture (Pay CTA is remittance URL only).
- MFA for high-sensitivity brokerage deployments.

OAuth tokens for QBO and mailboxes are encrypted at rest (AES-256-GCM) using `TOKEN_ENCRYPTION_KEY` or `INTUIT_TOKEN_ENCRYPTION_KEY`.

---

## 13. Background jobs, Redis, and document storage

### Document storage (`lib/document-storage.ts`)

- Object storage when bucket + access key + secret are set.
- Otherwise local `UPLOAD_DIR` (default `./uploads`).
- Relative keys `{companyId}/{hex}-{filename}`.
- Cutover helper: `scripts/migrate-uploads-to-s3.ts`.

### Redis (`lib/redis.ts`)

- Optional; powers `rate-limit.ts` and `cache.ts`.
- Falls back to in-memory structures when unset/unavailable.

### Jobs (`lib/jobs.ts`, `scripts/job-worker.ts`)

Postgres queue with `FOR UPDATE SKIP LOCKED`:

| Type | Purpose |
|------|---------|
| `GENERATE_PDF` | Render/persist PDF on `LoadDocument` |
| `SYNC_MAILBOX` | Sync mailbox threads |

Run: `npm run worker` (`JOB_WORKER_POLL_MS`, default 2000). Production also runs `tms-worker` via PM2 (`scripts/tms-worker.sh`).

---

## 14. UI system & navigation

### Staff shell (`components/app-shell.tsx`)

Grouped flyout nav:

1. **Operations** — Dashboard, Loads, Search, Dispatch  
2. **Network** — Customers, Carriers, Locations  
3. **Records** — Documents, Accounting, Commissions (+ Profiles admin), Reports  
4. **Admin** — Admin, Accounting Settings, Billing, Integrations, Email settings  

Also: org switcher, branch switcher, mobile menu, session heartbeat (`/api/auth/session`).

### Shared UI primitives

TileBoard (drag/resize), sortable tables, pagination, status badges, metric cards, search comboboxes, print button, auth brand panels, OAuth buttons, portal-specific map/board/login forms.

---

## 15. Codebase map

```text
app/                    App Router pages (broker + portal) + API route handlers
components/             UI: boards, tables, forms, maps, shells, editors
lib/                    Auth, permissions, server actions, search, docs, QBO,
                        mail, portal, commissions, late fees, jobs, storage, Stripe
lib/oauth/              Google/Microsoft identity helpers
lib/mail/               User mailbox helpers
lib/quickbooks/         Online + IIF + crypto + exports
lib/crypto/             Secret / encryption helpers
prisma/
  schema.prisma         Source of truth for models
  migrations/           Postgres migration history
  seed.ts               Demo brokerage data
  ascend-load-import.ts Ascend CSV importer
  backfill-*.ts         One-off data repairs
scripts/
  tms-deploy.sh         Production deploy (flock + migrate + build + PM2)
  tms-worker.sh         Worker process entry for PM2
  job-worker.ts         Job poller
  migrate-sqlite-to-postgres.ts   Legacy cutover
  migrate-uploads-to-s3.ts        Upload cutover
  setup-auto-deploy.md  Deploy plumbing notes
  nginx conf copies     Reference SSL/site configs
docs/                   This review and related setup notes
public/geo/             US states GeoJSON for state miles
.github/workflows/      Deploy on push to main
.cursor/rules/          Agent guidance (production deploy policy)
```

### Important `lib/` modules by concern

| Concern | Files |
|---------|-------|
| Staff auth / sessions | `auth.ts`, `auth-rate-limit.ts`, `password-reset-actions.ts`, `oauth/*` |
| Portal auth | `portal-auth.ts`, `portal-auth-actions.ts`, `portal-admin-actions.ts` |
| Access control | `permissions.ts`, `scope.ts`, `seats.ts`, `membership-*` |
| Core load ops | `actions.ts`, `load-search.ts`, `load-stops.ts`, `load-commodity.ts`, `load-route.ts` |
| Accounting | `accounting-actions.ts`, `accounting-aging.ts`, `accounting-payee.ts`, `late-fees*.ts` |
| Commissions | `commission.ts`, `commission-actions.ts`, `commission-search.ts` |
| Documents | `document-*.ts`, `pdf-*.ts` |
| Email ops | `email-ops-actions.ts`, `mail.ts`, `mail/*` |
| Billing | `billing-actions.ts`, `stripe.ts` |
| QuickBooks | `quickbooks/*` |
| Infra | `db.ts`, `redis.ts`, `cache.ts`, `rate-limit.ts`, `jobs.ts`, `document-storage.ts` |

---

## 16. Production deploy & operations

**URL:** https://tms.simple-source.com

### Preferred path

1. Push to `origin` **`main`**.
2. `.github/workflows/deploy.yml` POSTs a signed webhook to `https://tms.simple-source.com/hooks/tms-deploy`.
3. `scripts/tms-deploy.sh` (flock-serialized up to 30 minutes):
   - `git fetch` + hard reset to `origin/main`
   - `chmod +x` deploy/worker scripts
   - `npm ci --include=dev`
   - `prisma generate`
   - `prisma migrate deploy` (honors `DATABASE_MIGRATE_URL` when set)
   - production `next build` with `NODE_OPTIONS=--max-old-space-size=4096`
   - `pm2 reload` (or start) app `tms` and worker `tms-worker`

Do **not** also configure a GitHub repo webhook alongside Actions (double deploy). Do **not** treat SSH/rsync as the normal publish path.

### Verify

- GitHub → Actions → **Deploy** (green)
- Or debug: `ssh tms "tail -n 40 /var/log/tms-deploy.log"`

### Server paths of interest

| Path | Purpose |
|------|---------|
| `/var/www/tms` | App checkout |
| `/var/www/tms/scripts/tms-deploy.sh` | Deploy script |
| `/var/log/tms-deploy.log` | Deploy log |
| `/etc/nginx/sites-available/tms.simple-source.com` | Reverse proxy |

Agent policy for this is encoded in `.cursor/rules/deploy-production.mdc`.

### Legacy cutover notes

Production previously ran on SQLite / local uploads. Remnants are **cutover tools only**:

- `scripts/migrate-sqlite-to-postgres.ts`
- `scripts/migrate-uploads-to-s3.ts`

Current source of truth is PostgreSQL + migrations + optional S3.

---

## 17. Useful commands

```bash
npm run dev              # generate + migrate deploy + next dev
npm run build            # generate + next build
npm run start            # next start
npm run worker           # background jobs
npm run lint             # eslint, zero warnings allowed
npm run test             # tsx --test lib/**/*.test.ts
npm run setup            # generate + migrate deploy + seed
npm run db:migrate       # prisma migrate deploy
npm run db:migrate:dev   # prisma migrate dev
npm run db:seed          # seed demo data
npm run db:reset         # migrate reset + seed
npm run db:import-ascend # Ascend CSV import
npm run db:backfill-facilities
```

---

## 18. Strengths of the current system

- Covers a full brokerage operational loop in one product, not just a load board.
- Multi-tenant SaaS model with seats, branches, roles, and audit logging.
- Strong load detail model (stops, commodities, pay lines, docs, email threads, commissions).
- Real integrations where it matters most: Stripe, QBO/IIF, Google/Microsoft identity + mail, maps, FMCSA, EIA.
- Customer portal is a first-class separate surface with deliberate data isolation.
- Infrastructure moved to production-shaped primitives: Postgres migrations, optional S3 + Redis, durable job worker, serialized deploys.
- Practical ops features: clone load, late fees on overdue invoice email, factoring payees, Ascend import path.

---

## 19. Gaps, risks, and natural next steps

| Area | Current state | Likely next step |
|------|---------------|------------------|
| Load boards (DAT/Truckstop) | Placeholder tiles | Real posting/search APIs |
| Tracking / ELD / POD capture | Placeholder | Provider webhooks + auto check calls/POD |
| Portal payments | Remittance URL only | Stripe Connect or similar AR capture |
| Auth hardening | Rate limits present; no MFA | MFA for staff; continued auth abuse controls |
| Integration page UX | Mixed real vs placeholder | Hide/relabel placeholders or deep-link to working settings |
| Portal plan doc | `customer-portal-dashboard-plan.md` checkboxes stale | Mark shipped items done or archive plan |
| Concurrency / scale | Postgres + optional Redis/S3 ready | Ensure all prod envs set `REDIS_URL` + `S3_*` |

---

## 20. Collective conclusion

Freight Broker TMS 0.4.4 is a working multi-tenant brokerage platform: broker console + customer portal, Postgres-backed, deployed automatically from `main`, with seat billing and meaningful accounting/email/maps integrations already live. The product depth is concentrated in the load lifecycle, CRM, documents/email, AR/AP, commissions, and the customer-facing portal map/board/invoice experience.

If you only keep one reference document for onboarding or stakeholder review, **this file is the collective project review**. Supporting companions:

- `README.md` — quick start  
- `docs/STRIPE_SETUP.md` — seat billing setup  
- `docs/customer-portal-dashboard-plan.md` — original portal design notes (partially superseded by shipped code)  
- `.env.example` — authoritative env inventory  
- `prisma/schema.prisma` — authoritative data model  

---

*End of complete project review — generated from a thorough pass over the 0.4.4 codebase, schema, routes, integrations, and production deploy path.*
