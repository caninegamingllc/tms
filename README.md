# Freight Broker TMS

A beginner-friendly Freight Broker Transportation Management System inspired by the broad workflow of AscendTMS. It is built as one Next.js app with a local SQLite database so you can run it on your machine before moving to a hosted database.

## What It Includes

- Dashboard for active loads, revenue, margin, open AR, open AP, and check calls.
- Load management with customer tender details, stops, status workflow, pricing, documents, notes, and activity history.
- Customer CRM with contacts, credit limits, payment terms, invoice exposure, and load counts.
- Carrier CRM with MC/DOT fields, insurance expiration, compliance status, equipment, and load history.
- Dispatch board with carrier assignments, driver/truck/trailer details, check calls, and uncovered loads.
- Document library and generated paperwork for carrier rate confirmations, BOLs, customer invoices, POD, carrier packet, insurance, W-9, and other documents.
- Accounting for customer invoices, carrier bills, open receivables, open payables, and gross margin.
- Reports for profitability, lanes, customer volume, and carrier performance.
- Admin console with login, users, roles, branches, password resets, account lock/disable controls, and audit logs.
- Integrations placeholders for DAT, Truckstop, QuickBooks, tracking, factoring, and email.

## First-Time Setup

1. Install Node.js from https://nodejs.org if you do not already have it.
2. Install dependencies:

```bash
npm install
```

3. Create and seed the local database:

```bash
npm run setup
```

4. Start the app:

```bash
npm run dev
```

5. Open http://localhost:3000.

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
npm run dev        # start local development server
npm run build      # verify the production build
npm run setup      # generate Prisma, push schema, and seed demo data
npm run db:push    # apply Prisma schema to SQLite
npm run db:seed    # add demo customers, carriers, loads, and accounting data
npm run db:reset   # reset the local database and seed it again
```

## Demo Workflow

After seeding, open the dashboard and inspect `GLB-1001` and `GLB-1002`.

- `GLB-1001` shows a covered/dispatch workflow with a carrier, driver, check call, documents, invoice, and carrier bill.
- `GLB-1002` is available freight that needs carrier coverage.
- Use `Loads > New Load` to create another shipment.
- Use the load detail page to assign a carrier, update status, add check calls, and attach document records.
- Use the load detail page `Documents` panel to generate carrier rate confirmations, bills of lading, and customer invoice documents.
- Open generated documents from `Documents`, then use `Print / Save PDF` to print or save a PDF from your browser.
- Use `Accounting` to create invoices and carrier bills.
- Use `Accounting > Generate Customer Invoice Document` to generate printable invoices from accounting.
- Use `Admin` as the owner to create users, reset passwords, force password changes, lock/unlock accounts, disable/enable accounts, create branches, and review the audit log.

## Next Real Integrations

The integration pages are placeholders by design. Recommended next steps are:

- Replace path-based documents with S3, Azure Blob, or Supabase Storage.
- Add email-based password reset links, rate limiting, and multi-factor authentication before using real brokerage data in production.
- Connect QuickBooks for invoice and bill sync.
- Connect DAT or Truckstop for load posting and carrier search.
- Connect tracking/document-capture providers for automated check calls and POD capture.
