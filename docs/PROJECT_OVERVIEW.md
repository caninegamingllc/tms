# Freight Broker TMS — Project Overview

**Version:** 0.4.1  
**Production URL:** https://tms.simple-source.com  
**Repository:** Freight Broker Transportation Management System (Next.js + Prisma + SQLite)

A multi-tenant freight brokerage TMS inspired by AscendTMS-style workflows. One Next.js app handles operations, CRM, dispatch, documents, accounting, commissions, email ops, and admin billing.

---

## Table of Contents

1. [Stack & Architecture](#stack--architecture)
2. [Local Setup](#local-setup)
3. [Environment Variables](#environment-variables)
4. [Authentication & Access Control](#authentication--access-control)
5. [Multi-Tenancy, Branches & Seats](#multi-tenancy-branches--seats)
6. [Feature Catalog](#feature-catalog)
7. [API Routes](#api-routes)
8. [Integrations](#integrations)
9. [Database Model Summary](#database-model-summary)
10. [UI System](#ui-system)
11. [Production Deploy](#production-deploy)
12. [Useful Commands & Scripts](#useful-commands--scripts)
13. [Demo Seed Data](#demo-seed-data)
14. [Known Placeholders / Next Steps](#known-placeholders--next-steps)

---

## Stack & Architecture

| Layer | Choice |
|-------|--------|
| Framework | Next.js (App Router), React, TypeScript |
| Styling | Tailwind CSS |
| ORM / DB | Prisma 6 + SQLite (`DATABASE_URL=file:./dev.db`) |
| Auth | Cookie sessions (`tms_session`), scrypt password hashes, Google/Microsoft OAuth |
| Billing | Stripe seat subscriptions ($25/seat/month) |
| Maps / Places | Google Places, Geocoding, Routes APIs + Leaflet map UI |
| Carrier lookup | FMCSA QCMobile API |
| Fuel index | EIA weekly on-highway diesel |
| Email | Resend (system mail) + per-user Gmail/Outlook OAuth |
| Accounting sync | QuickBooks Online API + QuickBooks Desktop IIF export |
| Charts / PDF | Recharts, jsPDF (+ autoTable), VICS-style BOL PDF |
| Process manager (prod) | PM2 at `/var/www/tms` |

**Request gating:** `proxy.ts` redirects unauthenticated users to `/login`, with public exceptions for auth flows, Stripe webhook, and deploy hooks.

**Server actions:** Most mutations live under `lib/*-actions.ts` and `lib/actions.ts` (`"use server"`).

---

## Local Setup

1. Install Node.js (LTS recommended).
2. Install dependencies:

```bash
npm install
```

3. Copy env and fill required keys:

```bash
cp .env.example .env
```

4. Generate Prisma client, push schema, and seed demo data:

```bash
npm run setup
```

5. Start the dev server:

```bash
npm run dev
```

6. Open http://localhost:3000.

`npm run dev` also runs `prisma generate` and `prisma db push` before Next.js.

---

## Environment Variables

See `.env.example` for the full list. Summary:

### Core

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | SQLite path (default `file:./dev.db`) |
| `UPLOAD_DIR` | Local document upload directory |
| `APP_BASE_URL` | Public app URL (password reset, invites, Stripe, OAuth redirects) |
| `COOKIE_SECURE` | Force secure cookies (`true`/`false`); production HTTPS defaults secure |

### System email (password reset)

| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY` / `RESEND_FROM` | Preferred outbound mail via Resend |
| `SMTP_*` | Optional SMTP fallback (e.g. Resend SMTP) |

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

### Login methods

- Email + password
- Google sign-in
- Microsoft 365 sign-in
- Invite accept (password and/or OAuth)
- Company registration (creates workspace + owner)

### Session model

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

---

## Multi-Tenancy, Branches & Seats

### Organizations (companies)

- Each brokerage is a `Company` with slug, branding, load-number prefix/sequence
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
- **Freight line items** (`LoadCommodityLine`: qty, description, weight, pieces, dimensions)
- **Multi-stop lanes** (`LoadStop`: pickup/delivery sequences, facilities, appointments)
- Charges (`LoadCharge`) and expenses (`LoadExpense`: lumper, detention, TONU, other)
- Carrier assignment with driver/truck/trailer and **carrier pay lines** (flat / per mile / hourly / accessorials)
- Check calls with next-check scheduling
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

- CRM: status, credit limit, payment terms, industry, address/contacts
- Default rate confirmation terms
- Activity log and notes
- Linked documents, facilities, loads, invoices
- Google business search for company enrichment
- Branch assignment

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

- Upload files to `UPLOAD_DIR` (local filesystem)
- Multi-type tagging, attach to load/customer/carrier/company
- Generate printable HTML / PDF documents (rate con, load con, BOL including VICS-style PDF, invoice)
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
- QuickBooks Online sync and IIF export status per entity

Admin accounting settings: `/admin/accounting` (method ONLINE | IIF | NONE, account/item config).

### Commissions (`/commissions`, `/commissions/profiles`)

- Profiles with branch/company share % and company minimum expense floor
- Methods: standard split, expense floor, ineligible, no profit
- Per-load commission records: pending → payable → settled
- Settle by load or branch batch (accounting/admin roles)
- Branch default profile assignment

### Admin (`/admin`)

- Invite / create users, resend/cancel invites
- Roles, lock, disable, force password change, password reset
- Seat assign/unassign and usage summary
- Multi-branch user assignment
- Create/delete branches
- Company branding (logo, address, phone, email, website)
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
| `/accept-invite` | Invite onboarding |
| `/forgot-password` / `/reset-password` | Reset flow |
| `/change-password` | Forced or voluntary change |
| `/select-organization` | Org picker / seat messaging |
| `/logout` | End session |

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
| `/api/company/logo` | Company logo file |
| `/api/carriers/lookup` | FMCSA MC/DOT lookup |
| `/api/business-search` | Google business search |
| `/api/loads/[id]/route` | Compute/cache driving route + state miles |
| `/api/documents/[id]/file` | Serve uploaded/generated document bytes |
| `/api/ui-layout` | Persist drag-resize tile layouts |

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

### Token security

OAuth tokens for QuickBooks and mailboxes are encrypted at rest (AES-256-GCM) using `TOKEN_ENCRYPTION_KEY` or `INTUIT_TOKEN_ENCRYPTION_KEY`.

---

## Database Model Summary

Primary Prisma models (SQLite):

**Tenancy / access:** `Company`, `Branch`, `User`, `CompanyMembership`, `MembershipBranch`, `Session`, `SeatSubscription`, `OAuthAccount`, `AuditLog`

**Network:** `Customer`, `CustomerContact`, `CustomerActivity`, `Carrier`, `CarrierContact`, `CarrierActivity`, `CarrierComplianceDocument`, `CarrierInsuranceCoverage`, `Facility`, `FactoringCompany`

**Operations:** `Load`, `LoadStop`, `LoadCommodityLine`, `LoadCharge`, `LoadExpense`, `DispatchAssignment`, `CarrierPayLine`, `CarrierPayLineType`, `CheckCall`, `LoadNote`, `LoadActivity`, `CommodityOption`

**Documents / mail:** `LoadDocument`, `UserMailbox`, `EmailThread`, `EmailMessage`

**Money:** `Invoice`, `CarrierBill`, `Payment`, `PaymentApplication`, `CommissionProfile`, `CommissionProfileRule`, `LoadCommission`

**Integrations:** `IntegrationAccount`, `AccountingExport`

Schema file: `prisma/schema.prisma`.

---

## UI System

- Shared shell: `components/app-shell.tsx` (grouped nav flyouts, org switcher, branch switcher, mobile menu, session heartbeat)
- **TileBoard**: draggable/resizable page tiles with per-user layouts (`uiPreferences` JSON)
- Sortable tables + client pagination
- Status badges, metric cards, search comboboxes, print button
- Design refresh in 0.4.0 across auth, shell, and core views

Nav groups:

1. **Operations** — Dashboard, Loads, Search, Dispatch  
2. **Network** — Customers, Carriers, Locations  
3. **Records** — Documents, Accounting, Commissions, Reports  
4. **Admin** — Admin, Accounting Settings, Billing, Integrations, Email settings  

---

## Production Deploy

Production: **https://tms.simple-source.com**

### Automatic path (preferred)

1. Push to `origin` **`main`**.
2. GitHub Actions workflow `.github/workflows/deploy.yml` POSTs a signed webhook to  
   `https://tms.simple-source.com/hooks/tms-deploy`.
3. Server runs `scripts/tms-deploy.sh`:

   - `pm2 stop tms`
   - `git fetch` + `git reset --hard origin/main`
   - `chmod +x` deploy script (preserve executable bit)
   - `npm ci --include=dev`
   - `prisma generate` (+ optional membership migrate)
   - `prisma db push --accept-data-loss`
   - production `next build` with raised Node heap (`4096` MB)
   - `pm2 start/restart tms`

Do **not** also configure a GitHub repo webhook if Actions is already deployed (would double-deploy).

Secret: repo Action secret `DEPLOY_WEBHOOK_SECRET` must match `/etc/webhook.conf` on the server.

Full notes: [`scripts/setup-auto-deploy.md`](../scripts/setup-auto-deploy.md).

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
npm run dev              # prisma generate + db push + next dev
npm run build            # prisma generate + next build
npm run start            # next start
npm run lint             # eslint, zero warnings allowed
npm run setup            # generate + push + seed
npm run db:push          # apply schema
npm run db:seed          # seed demo data
npm run db:reset         # force-reset DB + seed
npm run db:import-ascend # import Ascend CSV loads
npm run db:backfill-facilities
```

Other repo scripts:

| Script | Purpose |
|--------|---------|
| `scripts/tms-deploy.sh` | Production deploy |
| `scripts/prod-inspect.sh` | Prod git/DB sanity checks |
| `scripts/prod-import-ascend.sh` | Stop PM2, import Ascend CSV, restart |
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

Demo PDF files are written under `uploads/demo/`.

---

## Known Placeholders / Next Steps

Already useful as-is for brokerage ops; still intentional gaps:

- DAT / Truckstop / ELD / Trucker Tools tiles are capability placeholders
- Documents store on local disk — production scale may want S3/Azure/Supabase
- SQLite is the current DB for local and this production droplet; hosted Postgres would be a natural upgrade for concurrency
- Rate limiting and MFA before handling highly sensitive broker data at scale
- Tracking/document-capture providers for automated check calls and POD

---

## Directory Map (high level)

```text
app/                 Next.js App Router pages + API routes
components/          UI components (boards, tables, forms, maps)
lib/                 Auth, actions, search, QuickBooks, mail, commissions, etc.
prisma/              schema.prisma, seed, import/backfill scripts
docs/                Stripe setup, this overview
scripts/             Deploy, nginx refs, prod helpers
public/geo/          US states GeoJSON for route state miles
.github/workflows/   Deploy on push to main
.cursor/rules/       Agent guidance (e.g. production deploy)
```

---

*Generated from a review of the codebase at release 0.4.1 (`d6aeff5` — editable load details, freight line items, and multi-stop lanes).*
