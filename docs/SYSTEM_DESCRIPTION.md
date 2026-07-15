# Freight Broker TMS — System Description

**Version:** 0.4.4  
**Production:** https://tms.simple-source.com  
**Audience:** Product, ops, engineers, and stakeholders who need a complete picture of what this system is and how it is organized.

---

## What this product is

**Freight Broker TMS** is a multi-tenant transportation management system for freight brokerages. It covers the full brokerage loop: tender intake and load lifecycle, customer and carrier CRM, dispatch and tracking, document generation and email ops, AR/AP accounting, commission settlement, and customer self-service.

Workflows are intentionally AscendTMS-inspired. The product is a single **Next.js** application with:

- A **broker operations console** for seated brokerage staff
- A separate **customer portal** for shippers and consignees to track loads and review invoices
- Shared tenancy, billing, and integrations behind both surfaces

One company (brokerage) is an isolated workspace. Users join via memberships with roles and optional branch scope. Operational access is gated by **Stripe seat subscriptions** ($25/seat/month).

---

## Who uses it

| Audience | How they enter | What they can do |
|----------|----------------|------------------|
| Brokers / dispatchers / accounting | Staff login (`tms_session`) | Full ops: loads, CRM, dispatch, docs, AR/AP, commissions |
| Company owners / admins | Staff login | Users, branches, seats/billing, catalogs, audit, integrations |
| Customers (shippers) | Portal login or magic link (`tms_portal_session`) | Read-only view of *their* loads, map progress, invoices, customer-facing documents |

Portal data is intentionally **whitelisted**. Customers never see carrier pay, broker margin, commissions, or private notes.

---

## Core product surfaces

### 1. Broker operations console

Grouped navigation in the app shell:

1. **Operations** — Dashboard, Loads, Search, Dispatch  
2. **Network** — Customers, Carriers, Locations  
3. **Records** — Documents, Accounting, Commissions, Reports  
4. **Admin** — Admin console, Accounting Settings, Billing, Integrations, Email settings  

**Dashboard** shows active-load and money metrics, EIA diesel fuel index, load board snapshot, and recent check calls on a configurable tile board.

**Loads** are the system of record. Each load has customer tender details, equipment (including reefer setpoint), multi-stop lanes, freight line items, revenue/expenses, carrier assignment with pay lines, check calls, notes/activity, documents, commission, and accounting links. Load status flows:

`QUOTE` → `AVAILABLE` → `COVERED` → `DISPATCHED` → `PICKED_UP` → `DELIVERED` → `INVOICED` → `PAID` (or `CANCELED`)

Loads can be **cloned** (optional carrier, rate, commodity, public notes) into a new load number. Routes can be computed via Google Routes with state-mileage breakdown and a Leaflet map.

**Dispatch** is a coverage-oriented board of uncovered and assigned freight. **Search / Reports** support flexible load filters, profitability/lane/customer volume views, and exports.

**Network CRM** covers customers (credit, terms, late-fee %, portal access, default rate-con terms), carriers (MC/DOT via FMCSA, insurance/compliance, factoring), and facilities used as load stops.

**Documents** support upload and generation (rate confirmation, customer load confirmation, BOL including VICS-style PDF, invoice, POD, carrier packet, W-9, insurance, and related types). Storage is **S3-compatible object storage** when configured, otherwise local disk.

**Accounting** covers customer invoices, carrier bills (including factoring payees), AR/AP aging, receipts/disbursements, bulk email, and QuickBooks Online push or QuickBooks Desktop IIF export. Overdue invoice emails can apply **customer late fees** as stackable charge lines before send.

**Commissions** use branch/company profiles (split, expense floor, ineligible, no profit) and per-load settle workflows for accounting/admin roles.

### 2. Customer portal (`/portal`)

A lightweight shell separate from the broker AppShell:

| Route | Purpose |
|-------|---------|
| `/portal` | Overview: metrics, interactive load map, board preview |
| `/portal/board` | Full customer dispatch board (no margin/pay columns) |
| `/portal/loads/[id]` | Customer-safe load detail, stops, check calls, docs |
| `/portal/invoices` / `[id]` | Invoice review + optional Pay URL CTA |
| `/portal/login` | Password login |
| `/portal/accept-invite` | Invite activation |
| `/portal/access` / `[token]` | Magic / share-link redeem |

Map pin rules: start at pickup → move with geocoded check calls → snap to delivery when status is `DELIVERED` or later. Invoiced/paid loads are hidden from the map. Brokers manage portal users and share links from the customer detail page.

### 3. Auth, tenancy, and money model

- **Staff auth:** email/password, Google, Microsoft 365; invites; password reset (Resend); forced password change; lock/disable; org switcher  
- **Portal auth:** invited password users and time-boxed magic links  
- **Tenancy:** `Company` → `Branch` → branch-scoped loads/customers/carriers/facilities  
- **Seats:** Stripe subscription quantity; memberships need `seatAssignedAt` for TMS pages (admins can still reach billing)  
- **Roles:** `OWNER`, `ADMIN`, `BROKER`, `DISPATCHER`, `ACCOUNTING`, `VIEWER`

---

## Architecture snapshot

```text
Browser
  ├─ Broker App (App Router pages + server actions)
  └─ Customer Portal (/portal/*)

Next.js app
  ├─ proxy.ts          public path gating (staff cookie vs portal)
  ├─ lib/*-actions.ts  mutations ("use server")
  ├─ Prisma Client     PostgreSQL
  ├─ Redis (optional)  rate limits + cache (in-memory fallback)
  ├─ S3 / local disk   documents & logos
  └─ BackgroundJob     Postgres job queue

Worker process (npm run worker)
  └─ GENERATE_PDF, SYNC_MAILBOX
```

| Concern | Choice |
|---------|--------|
| Framework | Next.js App Router, React, TypeScript, Tailwind |
| Database | PostgreSQL via Prisma 6 (migrations under `prisma/migrations`) |
| Local infra | Docker Compose: Postgres 16, Redis 7, MinIO |
| Auth cookies | `tms_session` (staff), `tms_portal_session` (portal) |
| Billing | Stripe seats |
| Maps | Google Places / Geocoding / Routes + Leaflet |
| Carrier data | FMCSA QCMobile |
| Fuel | EIA weekly diesel |
| Mail | Resend/SMTP (system) + per-user Gmail/Outlook OAuth (ops) |
| Accounting sync | QuickBooks Online API + IIF export |
| Deploy | Push `main` → GitHub Actions webhook → PM2 on production |

---

## Integrations (implemented vs placeholder)

**Implemented**

- Stripe seat checkout, customer portal, webhooks  
- QuickBooks Online connect/push + Desktop IIF export  
- Google / Microsoft identity OAuth  
- Gmail / Outlook send + reply sync on loads  
- Google Places / Geocoding / Routes  
- FMCSA MC/DOT lookup  
- EIA fuel index  
- Resend / SMTP system mail  
- Ascend CSV load import (`npm run db:import-ascend`)  
- Optional S3-compatible document storage  
- Optional Redis shared rate limit/cache  

**Placeholders / future**

- DAT, Truckstop, ELD, Trucker Tools tiles  
- Automated POD / tracking providers  
- Portal Stripe Connect card capture for AR (pay URL only today)  
- MFA for high-sensitivity brokerage deployments  

---

## Data domains (high level)

| Domain | Representative models |
|--------|------------------------|
| Tenancy & access | `Company`, `Branch`, `User`, `CompanyMembership`, `Session`, `SeatSubscription`, `AuditLog` |
| Customer portal | `CustomerPortalUser`, `CustomerPortalLink`, `CustomerPortalSession` |
| Network | `Customer`, `Carrier`, `Facility`, `FactoringCompany` (+ contacts, insurance, compliance) |
| Operations | `Load`, `LoadStop`, `LoadCommodityLine`, `DispatchAssignment`, `CarrierPayLine`, `CheckCall`, charges/expenses/notes/activity |
| Documents & mail | `LoadDocument`, `UserMailbox`, `EmailThread`, `EmailMessage` |
| Money | `Invoice`, `CarrierBill`, `Payment`, `PaymentApplication`, `CommissionProfile`, `LoadCommission` |
| Jobs / integrations | `BackgroundJob`, `IntegrationAccount`, `AccountingExport` |

Full schema: `prisma/schema.prisma`. Operator-oriented reference: [`PROJECT_OVERVIEW.md`](./PROJECT_OVERVIEW.md).

---

## Production operations

- **URL:** https://tms.simple-source.com  
- **Deploy path:** commit + push to `main` triggers `.github/workflows/deploy.yml`, which POSTs the production deploy webhook. The server pulls, migrates, builds, and restarts PM2.  
- **Do not** double-configure repo webhooks + Actions, and do not treat SSH as the normal deploy path.

Verify: GitHub Actions **Deploy** green, or `ssh tms "tail -n 40 /var/log/tms-deploy.log"`.

---

## How to think about the codebase

| Path | Role |
|------|------|
| `app/` | Routes: broker pages, portal pages, API handlers |
| `components/` | UI (boards, tables, forms, maps, shells) |
| `lib/` | Auth, permissions, server actions, search, docs, QBO, mail, portal, commissions |
| `prisma/` | Schema, migrations, seed, Ascend import / backfills |
| `scripts/` | Deploy, worker, SQLite→Postgres / uploads→S3 cutover helpers |
| `docs/` | This description, detailed overview, Stripe & portal planning notes |
| `.github/workflows/` | Production deploy on `main` |
| `.cursor/rules/` | Agent guidance (especially production deploy) |

---

*System description generated from a full codebase review at version 0.4.4 (PostgreSQL, customer portal, late fees, clone load, S3/Redis/worker stack).*
