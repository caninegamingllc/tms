# Simple Source TMS — Project Assessment

**Assessed version:** 0.4.5  
**Production:** https://tms.simple-source.com  
**Codebase snapshot:** ~50k lines of TypeScript/TSX across `app/`, `components/`, `lib/`, `prisma/`, `scripts/`  
**Date:** 2026-07-16

---

## Verdict

This is a **production-capable, multi-tenant freight brokerage TMS** with a surprisingly complete ops surface for its size: loads, CRM, dispatch, documents, AR/AP, commissions, seat billing, OAuth mail, QuickBooks, a customer portal, and a Premium+Trucking fleet layer. Architecture is a single Next.js App Router monolith on **PostgreSQL**, with optional Redis, S3-compatible storage, and a PM2 background worker.

**Maturity:** strong mid-stage SaaS product (brokerage core and monetization are real; marketplace load boards and full ELD depth are still scaffolding). Best fit is SMB freight brokers and small fleets who want AscendTMS-like workflows without enterprise complexity.

| Dimension | Rating (1–5) | Notes |
|-----------|--------------|-------|
| Feature breadth | 4.5 | Covers brokerage end-to-end; trucking modules newer |
| Feature depth / polish | 3.5 | Core paths solid; some integrations are tiles only |
| Tech stack fitness | 4.0 | Modern, coherent; “latest” pins are a risk |
| Multi-tenancy & billing | 4.5 | Orgs, seats, plan gates, Stripe quantity billing |
| Ops & deploy | 4.0 | Webhook → PM2 path is clear; single-droplet style |
| Security posture | 3.5 | Sessions, encryption, headers, rate limits present; MFA absent |
| Test coverage | 2.0 | Only 3 unit test files; lean automated safety net |
| Documentation accuracy | 3.0 | README strong; `PROJECT_OVERVIEW.md` partly stale (still cites SQLite) |

---

## 1. What the product is

**Simple Source TMS** (package `freight-broker-tms`) is a web TMS for freight brokerages, with an optional fleet/compliance layer for carriers who also run their own trucks.

Primary users:

- **Broker staff** — owners, admins, brokers, dispatchers, accounting, viewers
- **Customer portal users** — shippers viewing their loads/invoices (separate session)
- **Prospects** — public marketing landing at `/` with Free / Lite / Premium / Premium + Trucking pricing

Commercial model: **per-seat monthly Stripe subscriptions**, plan-gated features, Free tier capped at 1 seat and 25 loads/month.

---

## 2. Feature evaluation

### 2.1 Brokerage core (strong)

| Area | Assessment |
|------|------------|
| **Loads** | Full lifecycle (`QUOTE` → `PAID` / `CANCELED`), multi-stop lanes, commodity lines, charges/expenses, carrier pay lines, check calls, notes, activity, route map with state mileage, clone/delete |
| **Dispatch** | Configurable tile board; coverage / uncovered freight workflows |
| **Customers / Carriers** | CRM with contacts, credit, insurance/compliance, factoring, FMCSA MC/DOT lookup, Google business enrichment |
| **Locations** | Facilities as reusable shipper/consignee stops |
| **Documents** | Upload + generate rate con, load con, BOL (incl. VICS-style PDF), invoice; email from load; S3 or local disk |
| **Accounting** | Invoices, carrier bills, AR/AP aging, payments/applications, late fees, bulk email, QuickBooks Online + IIF |
| **Commissions** | Profiles, expense floors, per-load settle, branch batch settle |
| **Search / reports** | Filtered load search, profitability / lane / customer volume views, exports |
| **Admin** | Users, invites, seats, branches, branding, catalogs, factoring, audit log, billing |

This is the product’s center of gravity and is clearly battle-tested relative to newer modules.

### 2.2 Monetization & access control (strong)

Plans in `lib/plans.ts`:

| Plan | Price | Seats | Notable gates |
|------|-------|-------|----------------|
| Free | $0 | 1 | Basic loads/CRM only; 25 loads/mo |
| Lite | $20/seat | ≤5 | Dispatch, docs, AR/AP, IIF, FMCSA, etc. |
| Premium | $60/seat | uncapped | Commissions, portal, mailbox, QBO, full reports, integrations tile |
| Premium + Trucking | $100/seat | uncapped | Fleet assets, DQF, DVIR, safety, IFTA, ELD connect |

Enforcement uses `requirePlanFeature` / `assertPlanFeature` plus nav hiding — a clean pattern. Seat assignment gates operational TMS access while owners/admins can still reach billing.

### 2.3 Customer portal (good v1)

Implemented under `/portal/*` with its own auth (`tms_portal_session`), magic links, board, load detail, invoices, and pay-URL CTA. Data is intended to be customer-safe (no carrier pay/margin leakage). Matches the plan in `docs/customer-portal-dashboard-plan.md` at a usable first release; map/check-call pin behavior is the differentiator.

### 2.4 Fleet / trucking (functional scaffolding → useful ops)

Premium + Trucking unlocks:

- Drivers, trucks, trailers + maintenance
- Compliance dashboard, DQF checklist + packet export
- Safety register, DVIR, driver settlements
- IFTA quarters / worksheets (with unit tests)
- ELD provider tiles (Samsara / Motive / Geotab) with token connect and vehicle sync — deeper live telemetry still “Phase 2”

Useful for small fleets; not yet a full fleet TMS competitor.

### 2.5 Integrations (mixed)

| Integration | Status |
|-------------|--------|
| Stripe seats / portal / webhooks | Production-ready |
| Google / Microsoft identity + Gmail/Outlook mail | Implemented |
| Google Places / Geocoding / Routes | Implemented |
| FMCSA QCMobile | Implemented |
| EIA diesel index | Implemented |
| Resend / SMTP system mail | Implemented |
| QuickBooks Online + Desktop IIF | Implemented |
| Samsara / Motive / Geotab ELD | Partial (connect/sync scaffolding) |
| DAT / Truckstop / Trucker Tools / factoring APIs | Placeholder capability tiles |

Placeholders are intentional product surface, not dead code pretending to work — still a sales expectation risk if demos imply live load-board posting.

### 2.6 Gaps / weaker areas

- **No MFA** despite production brokerage data
- **Thin automated tests** (plans, late fees, IFTA worksheet only)
- **Marketplace load boards** not live
- **Docs drift**: `docs/PROJECT_OVERVIEW.md` still describes SQLite; README and schema correctly use Postgres
- Large action modules (`lib/actions.ts` ~67k) concentrate mutation logic — harder to review and test

---

## 3. Tech stack assessment

### 3.1 Stack map

| Layer | Choice | Fit |
|-------|--------|-----|
| UI framework | Next.js App Router + React + TypeScript | Excellent for SSR forms + server actions |
| Styling | Tailwind CSS + Lucide | Fine for dense ops UI |
| Data | Prisma 6 + **PostgreSQL** | Correct upgrade from earlier SQLite era |
| Auth | Cookie sessions (`tms_session`), scrypt passwords, Google/MS OAuth | Adequate; custom (not NextAuth) |
| Billing | Stripe (Checkout + Customer Portal + webhooks) | Appropriate |
| Storage | Local `UPLOAD_DIR` **or** S3-compatible (R2/MinIO/Spaces) | Production-ready abstraction |
| Cache / limits | Redis optional; in-memory fallback | Good multi-instance path |
| Jobs | `BackgroundJob` table + `tsx` worker (PDF, mailbox sync) | Simple and deployable via PM2 |
| Maps | Google APIs + Leaflet + Turf + US GeoJSON | Solid for miles/state breakdown |
| Charts / PDF | Recharts, jsPDF | Adequate |
| Validation | Zod | Present where used |
| Process (prod) | PM2 + nginx + webhook deploy | Fits single VPS |

### 3.2 Architecture pattern

- **Monolith**: pages in `app/`, UI in `components/`, server mutations in `lib/*-actions.ts`
- **Gating**: `proxy.ts` for unauthenticated redirects; public exceptions for marketing, portal, OAuth, Stripe webhook, deploy hooks
- **Tenancy**: `Company` → `CompanyMembership` → seats/branches; row-level companyId scoping throughout Prisma queries
- **Security headers** in `next.config.mjs` (HSTS, frame deny, nosniff, basic CSP `frame-ancestors`)
- **Secrets at rest**: AES-256-GCM for OAuth/integration tokens

### 3.3 Stack risks

1. **`"latest"` dependency pins** for Next, React, Tailwind, ESLint, Zod, etc. — reproducible builds and surprise breaking changes are a concern; prefer locked semver ranges for production.
2. **Single-process assumptions** mitigated by Redis/S3/worker, but default local path still works without them — easy to under-configure prod.
3. **Server Actions body limit 26mb** aligned with uploads — fine, but keep abuse/rate limits in mind.
4. **Custom auth** means you own session rotation, CSRF posture, and invite/reset edge cases (rate limiting exists via `lib/auth-rate-limit.ts` / `lib/rate-limit.ts`).

### 3.4 Data model

~**60 Prisma models**, ~1.4k lines of schema — rich but coherent domains: tenancy, network CRM, loads, documents/mail, money, integrations, fleet, background jobs. Migrations under `prisma/migrations/` (Postgres lockfile) replace older `db push` habits; deploy script uses `prisma migrate deploy`.

---

## 4. Setup & environment assessment

### 4.1 Local development (good)

Documented path:

1. `docker compose up -d` → Postgres 16, Redis 7, MinIO  
2. Copy `.env.example` → `.env`  
3. `npm install` + `npm run setup` (generate, migrate, seed)  
4. `npm run dev` (+ optional `npm run worker`)

Seeded accounts (`owner@example.com` / `dispatch@example.com`) and demo loads (`GLB-1001`, `GLB-1002`) make onboarding concrete.

**Strengths:** compose file with healthchecks; env example is thorough; seed is substantial.

**Friction:** many optional API keys (Google, FMCSA, EIA, Stripe, OAuth, Intuit) — core CRUD works without them, maps/billing/mail need configuration.

### 4.2 Production deploy (clear, VPS-oriented)

Preferred path:

1. Push to `main`  
2. GitHub Actions (`.github/workflows/deploy.yml`) HMAC-signs a POST to `/hooks/tms-deploy`  
3. Server `scripts/tms-deploy.sh`: flock, hard reset to `origin/main`, `npm ci`, `prisma migrate deploy`, production build (4GB heap), PM2 reload app + worker  

**Strengths:** serialized deploys, worker included, migrate-not-push, documented verify steps.

**Characteristics / risks:**

- Assumes a **single app directory** (`/var/www/tms`) — classic droplet, not Kubernetes
- `git reset --hard` deploy — simple, no blue/green
- Build on the same box as runtime — CPU/RAM spikes during deploy
- Action secret `DEPLOY_WEBHOOK_SECRET` must stay in sync with server webhook config

Legacy SQLite → Postgres and uploads → S3 migration scripts exist for cutover.

### 4.3 Tooling quality

| Concern | Status |
|---------|--------|
| TypeScript | Enabled throughout |
| ESLint | `eslint . --max-warnings=0` |
| Unit tests | `tsx --test` — sparse |
| Prisma seed / import | Seed + Ascend CSV import + backfills |
| Agent/deploy rules | `.cursor/rules` for production push discipline |

---

## 5. Product positioning

**Closest inspirations:** AscendTMS-style brokerage workflow.

**Differentiators already present:**

- Modern SaaS packaging (Free → Trucking) with real feature gates  
- Built-in customer portal  
- Combined broker + light fleet/compliance offering  
- Practical accounting (QBO + IIF) without forcing one ERP  

**Competitive gaps vs mature TMS vendors:** live load boards (DAT/Truckstop), deep ELD/tracking automation, factoring network APIs, MFA/SSO enterprise controls, mobile driver apps, extensive audit/compliance certifications.

---

## 6. Recommendations (prioritized)

### Near-term (stability & trust)

1. **Pin dependency versions** (especially Next/React/Prisma) and keep lockfile as source of truth.  
2. **Refresh `docs/PROJECT_OVERVIEW.md`** to match Postgres, S3, Redis, portal, and plan tiers (or point readers at this assessment + README).  
3. **Expand tests** around billing/webhooks, portal data whitelisting, seat/plan gates, and load status transitions.  
4. **Add MFA** (TOTP) for owner/admin before marketing to larger brokerages.

### Mid-term (product)

5. Finish **one** marketplace integration deeply (DAT *or* Truckstop) rather than many placeholders.  
6. Harden **ELD Phase 2** (live location/HOS) for Premium + Trucking differentiation.  
7. Split oversized `lib/actions.ts` into domain modules for maintainability.  
8. Consider **hosted Postgres + object storage** as the documented production default (scripts already support it).

### Longer-term (scale)

9. CI pipeline beyond deploy webhook: lint + test + build on PR.  
10. Observability (structured logs, error tracking, uptime) on the droplet.  
11. Evaluate horizontal scale (Redis-backed sessions/limits already help; sticky sessions or external session store if multi-node).

---

## 7. Directory map (current)

```text
app/                 App Router pages + API routes (broker + portal + marketing)
components/          Shared UI (shell, boards, tables, maps, landing)
lib/                 Auth, plans/seats, domain actions, integrations, PDF/mail
prisma/              schema, migrations, seed, Ascend import, backfills
docs/                Overview, Stripe setup, portal plan, this assessment
scripts/             Deploy, worker, nginx refs, SQLite/S3 migration helpers
public/geo/          US states GeoJSON for route state miles
.github/workflows/   Deploy on push to main
docker-compose.yml   Local Postgres + Redis + MinIO
```

---

## 8. Summary scores (qualitative)

- **As a brokerage ops tool:** ready for real SMB use on Lite/Premium.  
- **As a SaaS business:** billing, tenancy, marketing landing, and portal form a credible commercial shell.  
- **As an engineering system:** coherent monolith with improving infra (Postgres/S3/Redis/worker); needs tighter dependency discipline, docs sync, and automated tests to match feature velocity.

Overall: **a focused, feature-rich TMS that has outgrown “demo” and is operating as a live product**, with clear next work in integrations depth, security hardening, and engineering hygiene rather than greenfield feature invention.
