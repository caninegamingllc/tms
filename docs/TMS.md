# Simple Source TMS

**Product:** Simple Source Transportation Management  
**Package:** `freight-broker-tms`  
**Version:** `0.3.1` (commit `fc9ce10` — dashboard diesel price graph from EIA data)  
**Stack:** Next.js (App Router) · React · TypeScript · Prisma · SQLite · Tailwind CSS

A freight-broker Transportation Management System modeled after AscendTMS-style brokerage workflows. It runs as a single Next.js application with a local SQLite database (Prisma), multi-organization memberships, branch-scoped data, Stripe seat licensing, and operational modules for loads through accounting and commissions.

---

## What this product is

Simple Source TMS is a brokerage operations app for:

1. Booking and managing customer freight (loads)
2. Vetting and assigning carriers
3. Running a dispatch board with check calls
4. Generating/storing documents
5. Invoicing customers and tracking carrier payables
6. Settling branch commissions
7. Administering users, branches, seats, and audit history

The UI brand is **Simple Source / Transportation Management**. Demo load numbers default to a company prefix such as `GLB` (configurable per organization).

---

## Current version highlight (v0.3.1)

The Operations Dashboard includes a **Current Fuel Index** card powered by the U.S. Energy Information Administration (EIA) Open Data API:

- Weekly on-highway diesel prices
- Regional series: U.S., East Coast, Midwest, Gulf Coast, West Coast, California
- Range tabs: 4W / 3M / 6M / 1Y
- Interactive Recharts chart with region chips, week-over-week delta, and year high/low summary
- Requires `EIA_API_KEY` (see `.env.example`)

Implementation: `lib/eia-diesel.ts`, `components/fuel-index-card.tsx`, wired from `app/page.tsx`.

---

## Architecture

| Layer | Detail |
| --- | --- |
| Framework | Next.js App Router (`app/`), server components + server actions |
| Data | Prisma models in `prisma/schema.prisma`, SQLite via `DATABASE_URL` |
| Auth | Cookie sessions (`Session`), password hashes, invite tokens, password-reset tokens |
| Tenancy | `Company` → `CompanyMembership` → optional `MembershipBranch` assignments |
| Licensing | `SeatSubscription` synced with Stripe; operational pages require an assigned seat |
| Branch filter | Header `BranchSwitcher`; server scope via `lib/scope.ts` / `lib/branch-filter-server.ts` |
| Files | Local upload dir (`UPLOAD_DIR`, default `./uploads`) |
| Proxies / APIs | Carrier lookup (FMCSA), business/places search (Google), load routes (Google Routes), Stripe webhook, document file serving |

### Multi-tenant model

- A **User** can belong to multiple **Companies** through **CompanyMembership**.
- Each membership has a **role**, **status**, optional primary **branch**, and many-to-many **assigned branches**.
- Sessions bind to a specific membership (active organization).
- Most operational records (`Customer`, `Carrier`, `Facility`, `Load`, …) are company-scoped and optionally branch-scoped.

---

## Access control

### Roles

| Role | Capability summary |
| --- | --- |
| `OWNER` | Admin + billing + user/branch management |
| `ADMIN` | Same admin console access as owner for day-to-day ops |
| `BROKER` | Read/write brokerage data |
| `DISPATCHER` | Read/write brokerage data |
| `ACCOUNTING` | Read/write; may settle commissions |
| `VIEWER` | Read-only (`canWrite` is false) |

### Seats

- Stripe bills **$25/seat/month** per organization (`docs/STRIPE_SETUP.md`).
- Purchased quantity lives on `SeatSubscription.seatQuantity`.
- Members need `seatAssignedAt` to use operational TMS pages.
- Owners/admins can still reach **Admin** and **Billing** without a seat.

### Branch visibility

- Owners/admins (or members with no branch assignment): all company branches, with optional switcher filter.
- Members with assigned branches: only those branches.
- Creating records respects writable branch resolution (`resolveBranchId`).

### Membership statuses

`ACTIVE`, `LOCKED`, `DISABLED`, `INVITED`

---

## Application modules

Navigation (`components/app-shell.tsx`):

Dashboard · Loads · Search · Customers · Locations · Carriers · Dispatch · Documents · Accounting · Commissions · Commission Profiles (admin) · Reports · Admin (admin) · Billing (admin) · Integrations

### 1. Operations Dashboard (`/`)

- Metric cards: active loads, booked revenue + margin, open AR, carrier/customer network counts
- **Current Fuel Index** (EIA diesel chart — v0.3.1)
- Load board snapshot (sortable recent loads)
- Recent check calls

### 2. Loads (`/loads`, `/loads/new`, `/loads/[id]`)

**Load lifecycle statuses**

`QUOTE` → `AVAILABLE` → `COVERED` → `DISPATCHED` → `PICKED_UP` → `DELIVERED` → `INVOICED` → `PAID` (plus `CANCELED`)

**Core fields**

- Company-unique `loadNumber` (prefix + sequence settings on `Company`)
- Customer, branch, equipment, commodity, weight, lane cities/states, pickup/delivery dates
- `revenueCents` / `carrierCostCents`
- Commission flags/profile, stops, charges, expenses
- Cached route metrics: total miles, state miles (`Json`), polyline, computed-at

**Load detail capabilities**

- Status updates and load deletion
- Carrier assignment (driver, phone, truck, trailer, rate)
- Check calls with location, status, notes, next-check time
- Document upload + generate rate confirmation, BOL, customer invoice
- Notes and activity history
- Interactive route map / state mileage (`LoadRoutePanel`, Google Routes)
- Commission profile assignment, expenses (Lumper / Detention / TONU / Other), settlement actions

**Equipment types:** Dry Van, Reefer, Flatbed, Step Deck, Power Only, Box Truck

### 3. Search & reports (`/search`, `/reports`)

- Filter-first load search (customer, status, dates, lanes, equipment, load number, etc.)
- Results table + CSV/export tooling
- Revenue report view (`view=revenue`)
- `/reports` redirects into `/search?view=revenue`

### 4. Customers CRM (`/customers`, `/customers/[id]`)

- Status, credit limit, payment terms, industry, contact info, address
- Contacts (`CustomerContact`)
- Links to facilities, loads, documents, invoices
- Google Places-backed business search when configured

### 5. Locations / facilities (`/locations`)

- Company facility registry for shipper/consignee/stop locations
- Types: `GENERAL`, `SHIPPER`, `CONSIGNEE`, `DISTRIBUTION_CENTER`, `PORT`, `RAIL`
- Optional customer link; used by load stops

### 6. Carriers CRM (`/carriers`, `/carriers/[id]`)

- MC/DOT (normalized indexes), equipment, safety rating, insurance expiration, compliance status
- Contacts, compliance documents, insurance coverages  
  (Auto Liability, Cargo, GL, Workers Comp, Trailer Interchange, Other)
- FMCSA QCMobile lookup autocomplete (`FMCSA_WEB_KEY`, `/api/carriers/lookup`)
- Dispatch assignment history and carrier bills

### 7. Dispatch board (`/dispatch`)

Configurable board (`components/dispatch-board.tsx`) with stages:

| Stage | Meaning |
| --- | --- |
| Pending | Entered load, not booked with a carrier |
| Active | Booked with a carrier |
| En Route | Picked up |
| Completed | Delivered / ready to invoice |
| Invoiced | Invoice sent |
| Paid | Payment received |

Toggleable columns (persisted in browser storage): load, stage, status, customer, lane, pickup/delivery, equipment, commodity, carrier, driver, truck/trailer, rates, financials, last/next check call.

### 8. Documents (`/documents`, `/documents/new`, `/documents/[id]`)

- Upload or record documents attached to load, customer, carrier, and/or company
- Types include: BOL, POD, RATE_CONFIRMATION, INVOICE, CARRIER_PACKET, DOT_MC_FF_URS, NOA, W9, INSURANCE_PROOF, BROKER_CONTRACT, INSURANCE, OTHER
- Generated content for rate cons, BOLs, invoices (printable / save PDF)
- File serving via `/api/documents/[id]/file`

### 9. Accounting (`/accounting`)

- Create customer invoices and carrier bills against loads
- Statuses: `DRAFT`, `SENT`, `APPROVED`, `PARTIAL`, `PAID`, `OVERDUE`, `VOID`
- Open AR / open AP / gross margin metrics
- Generate printable customer invoice documents from accounting

### 10. Commissions (`/commissions`, `/commissions/profiles`)

**Profiles** define branch/company split rules:

- Default split example: 60% branch / 40% company
- `companyMinimumExpensePercent` floor (expense-floor method when standard company share is below floor)
- Methods: `STANDARD_SPLIT`, `EXPENSE_FLOOR`, `INELIGIBLE`, `NO_PROFIT`

**Per-load commissions** track revenue, gross expense, gross profit, branch/company shares, status (`PENDING` / `PAYABLE` / `SETTLED` / `INELIGIBLE`), payable/settled timestamps. Settlement allowed for OWNER, ADMIN, ACCOUNTING.

### 11. Admin (`/admin`)

Tabs for users, branches, settings, audit:

- Invite users (email + invite link), assign roles
- Multi-branch membership assignment
- Lock / unlock / disable / enable accounts
- Password reset / force password change
- Create branches; assign commission profiles to branches
- Load number prefix + next sequence settings
- Seat summary and assignment
- Audit log of admin/security actions

### 12. Billing (`/admin/billing`)

- Stripe Checkout for seat quantity
- Webhook sync at `/api/stripe/webhook`
- Dev promo code support (`STRIPE_DEV_PROMO_CODE`)

### 13. Integrations (`/integrations`)

Placeholder cards only (not live API connections):

DAT · Truckstop · QuickBooks · Trucker Tools · ELD · Factoring · Email

Seeded as `IntegrationAccount` rows with planned capability lists.

### 14. Auth & onboarding surfaces

- `/login`, `/register`, `/logout`
- `/forgot-password`, `/reset-password` (Resend email or SMTP; local links when mail unset)
- `/change-password` (forced on first login when flagged)
- `/accept-invite`, `/select-organization`

---

## Data model (entities)

Primary Prisma models:

`Company`, `Branch`, `User`, `CompanyMembership`, `MembershipBranch`, `SeatSubscription`, `Session`, `AuditLog`, `Customer`, `CustomerContact`, `Carrier`, `CarrierContact`, `CarrierComplianceDocument`, `CarrierInsuranceCoverage`, `Facility`, `Load`, `LoadStop`, `LoadCharge`, `LoadExpense`, `CommissionProfile`, `CommissionProfileRule`, `LoadCommission`, `DispatchAssignment`, `CheckCall`, `LoadDocument`, `LoadNote`, `LoadActivity`, `Invoice`, `CarrierBill`, `IntegrationAccount`

Money is stored in **integer cents**.

---

## External integrations (live vs placeholder)

| Integration | Status | Purpose |
| --- | --- | --- |
| EIA Open Data | Live (optional) | Dashboard weekly diesel fuel index |
| Google Places / Geocoding / Routes | Live (optional) | Business search, address autocomplete, load routing & maps |
| FMCSA QCMobile | Live (optional) | Carrier MC/DOT lookup |
| Stripe | Live (optional) | Seat subscriptions |
| Resend / SMTP | Live (optional) | Password reset and invite email |
| DAT, Truckstop, QuickBooks, ELD, factoring, etc. | Placeholder UI only | Future brokerage tooling |

---

## Import & ops tooling

Scripts and Prisma utilities include:

- `npm run setup` — generate Prisma client, push schema, seed demo data
- `npm run db:import-ascend` — Ascend TMS CSV load import (`prisma/ascend-load-import.ts`)
- `npm run db:backfill-facilities`
- Membership migration helpers under `prisma/`
- Deploy helpers under `scripts/` (nginx, droplet deploy notes)

Seeded demo logins (see root `README.md`):

- Owner: `owner@example.com` / `ChangeMe123!`
- Dispatcher: `dispatch@example.com` / `ChangeMe123!` (forced password change)

Demo loads typically include covered and available freight examples such as `GLB-1001` / `GLB-1002`.

---

## Local run

```bash
npm install
npm run setup
npm run dev
```

Open `http://localhost:3000`. Required env vars are documented in `.env.example`.

---

## Product boundaries (exact as of v0.3.1)

**In scope today**

- Full broker load → dispatch → document → AR/AP → commission workflow
- Multi-org + branch security model with seat licensing
- Search/export and dashboard fuel market context
- Local document storage and generated paperwork
- Ascend-oriented CSV import path

**Not connected yet**

- Live load boards (DAT/Truckstop)
- QuickBooks accounting sync
- Automated ELD/tracking check calls
- Factoring payment callbacks
- Hosted blob storage for documents (still filesystem/`UPLOAD_DIR`)

This document describes the TMS **as implemented in the repository at version 0.3.1**, not a future roadmap product.
