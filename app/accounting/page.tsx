import Link from "next/link";
import { CarrierBillsTable, InvoicesTable } from "@/components/accounting-tables";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { createCarrierBill, createInvoice, generateCustomerInvoice } from "@/lib/actions";
import { getBranchScope } from "@/lib/branch-filter-server";
import { requireTmsAccess } from "@/lib/permissions";
import { paymentStatuses } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { formatMoney, humanize } from "@/lib/format";
import { reconcileQuickbooksPaymentsAction } from "@/lib/quickbooks/actions";
import {
  getCompanyQuickbooksMethod,
  getExportsForEntities,
  toExportStatusView
} from "@/lib/quickbooks/exports";
import type { AccountingExportMethod, QuickbooksMethod } from "@/lib/quickbooks/types";

export default async function AccountingPage({
  searchParams
}: {
  searchParams: Promise<{
    reconciled?: string;
    invoices?: string;
    bills?: string;
    error?: string;
  }>;
}) {
  const user = await requireTmsAccess();
  const params = await searchParams;
  const loadScope = await getBranchScope(user);
  const quickbooksMethod = await getCompanyQuickbooksMethod(user.companyId);
  const activeExportMethod: AccountingExportMethod | null =
    quickbooksMethod === "ONLINE" || quickbooksMethod === "IIF" ? quickbooksMethod : null;

  const [loads, invoices, carrierBills, carriers, qboAccount] = await Promise.all([
    prisma.load.findMany({
      where: loadScope,
      orderBy: { loadNumber: "desc" },
      include: { customer: true, dispatchAssignment: true }
    }),
    prisma.invoice.findMany({
      where: { companyId: user.companyId, load: loadScope },
      orderBy: { createdAt: "desc" },
      include: {
        customer: true,
        load: { include: { commission: true } }
      }
    }),
    prisma.carrierBill.findMany({
      where: { companyId: user.companyId, load: loadScope },
      orderBy: { createdAt: "desc" },
      include: { carrier: true, load: true }
    }),
    prisma.carrier.findMany({ where: loadScope, orderBy: { name: "asc" } }),
    prisma.integrationAccount.findUnique({
      where: {
        companyId_provider: { companyId: user.companyId, provider: "QUICKBOOKS" }
      }
    })
  ]);

  const invoiceExports = activeExportMethod
    ? await getExportsForEntities({
        companyId: user.companyId,
        method: activeExportMethod,
        entityType: "INVOICE",
        entityIds: invoices.map((invoice) => invoice.id)
      })
    : new Map();

  const billExports = activeExportMethod
    ? await getExportsForEntities({
        companyId: user.companyId,
        method: activeExportMethod,
        entityType: "CARRIER_BILL",
        entityIds: carrierBills.map((bill) => bill.id)
      })
    : new Map();

  const openAr = invoices
    .filter((invoice) => invoice.status !== "PAID" && invoice.status !== "VOID")
    .reduce((sum, invoice) => sum + invoice.totalCents, 0);
  const openAp = carrierBills
    .filter((bill) => bill.status !== "PAID" && bill.status !== "VOID")
    .reduce((sum, bill) => sum + bill.totalCents, 0);
  const grossMargin = loads.reduce(
    (sum, load) => sum + load.revenueCents - load.carrierCostCents,
    0
  );

  const qboConnected = qboAccount?.status === "Connected";
  const method: QuickbooksMethod = quickbooksMethod;

  const invoiceRows = invoices.map((invoice) => {
    const exportView = activeExportMethod
      ? toExportStatusView(activeExportMethod, invoiceExports.get(invoice.id) ?? null)
      : null;
    return {
      id: invoice.id,
      invoiceNo: invoice.invoiceNo,
      loadId: invoice.loadId,
      loadNumber: invoice.load.loadNumber,
      customerName: invoice.customer.name,
      status: invoice.status,
      totalCents: invoice.totalCents,
      dueAt: invoice.dueAt?.toISOString() ?? null,
      commissionCents: invoice.load.commission?.branchShareCents ?? null,
      canMarkPaid: invoice.status !== "PAID" && invoice.status !== "VOID",
      exportLabel: exportView?.label ?? null,
      canPushOnline:
        method === "ONLINE" &&
        qboConnected &&
        invoice.status !== "VOID"
    };
  });

  const carrierBillRows = carrierBills.map((bill) => {
    const exportView = activeExportMethod
      ? toExportStatusView(activeExportMethod, billExports.get(bill.id) ?? null)
      : null;
    return {
      id: bill.id,
      billNo: bill.billNo,
      loadId: bill.loadId,
      loadNumber: bill.load.loadNumber,
      carrierName: bill.carrier.name,
      status: bill.status,
      totalCents: bill.totalCents,
      dueAt: bill.dueAt?.toISOString() ?? null,
      exportLabel: exportView?.label ?? null,
      canPushOnline: method === "ONLINE" && qboConnected && bill.status !== "VOID",
      canMarkPaid: bill.status !== "PAID" && bill.status !== "VOID"
    };
  });

  return (
    <>
      <PageHeader
        title="Accounting"
        description="Manage customer invoices, carrier bills, gross margin, receivables, payables, and settlement readiness."
      />

      {params.error ? (
        <div className="card mb-6 border-rose-200 bg-rose-50 text-sm font-semibold text-rose-700">
          {params.error}
        </div>
      ) : null}
      {params.reconciled ? (
        <div className="card mb-6 border-emerald-200 bg-emerald-50 text-sm font-semibold text-emerald-800">
          Reconciled {params.invoices ?? "0"} invoice(s) and {params.bills ?? "0"} bill(s) from QuickBooks
          Online.
        </div>
      ) : null}

      {method !== "NONE" ? (
        <section className="card mb-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="section-title">QuickBooks</h2>
              <p className="muted">
                Active method:{" "}
                <span className="font-semibold text-foreground">
                  {method === "ONLINE" ? "QuickBooks Online" : "IIF (Desktop)"}
                </span>
                . Export status below is for this method only.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {method === "IIF" ? (
                <>
                  <a href="/api/integrations/quickbooks-desktop/export" className="btn">
                    Download IIF (pending)
                  </a>
                  <a
                    href="/api/integrations/quickbooks-desktop/export?includeExported=1"
                    className="btn-secondary"
                  >
                    Download IIF (all)
                  </a>
                </>
              ) : null}
              {method === "ONLINE" && qboConnected ? (
                <form action={reconcileQuickbooksPaymentsAction}>
                  <button type="submit" className="btn-secondary">
                    Reconcile Payments
                  </button>
                </form>
              ) : null}
              <Link href="/admin/accounting" className="btn-secondary">
                Settings
              </Link>
            </div>
          </div>
          {method === "IIF" ? (
            <p className="mt-3 text-sm text-slate-700">
              After downloading, back up your QuickBooks Desktop company file, then use File → Utilities → Import →
              IIF.
            </p>
          ) : null}
          {method === "ONLINE" && !qboConnected ? (
            <p className="mt-3 text-sm text-amber-800">
              Connect QuickBooks Online under{" "}
              <Link href="/admin/accounting" className="font-semibold underline">
                Admin Accounting Settings
              </Link>{" "}
              before pushing documents.
            </p>
          ) : null}
        </section>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Open AR" value={formatMoney(openAr)} detail="Customer invoices outstanding" />
        <MetricCard label="Open AP" value={formatMoney(openAp)} detail="Carrier bills not yet paid" />
        <MetricCard label="Gross Margin" value={formatMoney(grossMargin)} detail="Revenue minus carrier cost" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="card overflow-hidden p-0">
          <div className="border-b border-border p-5">
            <h2 className="section-title">Customer Invoices</h2>
            <p className="muted">Invoices are tied directly to customer loads. Click column headers to sort.</p>
          </div>
          <div className="overflow-x-auto">
            <InvoicesTable invoices={invoiceRows} quickbooksMethod={method} />
          </div>
        </section>

        <section className="card overflow-hidden p-0">
          <div className="border-b border-border p-5">
            <h2 className="section-title">Carrier Bills</h2>
            <p className="muted">Track AP, quick pay, and settlement-style payables. Click column headers to sort.</p>
          </div>
          <div className="overflow-x-auto">
            <CarrierBillsTable bills={carrierBillRows} quickbooksMethod={method} />
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="card">
          <h2 className="section-title">Generate Customer Invoice Document</h2>
          <p className="muted">Create a printable invoice from the selected load customer, lane, and charges.</p>
          <form action={generateCustomerInvoice} className="mt-4 grid gap-3">
            <select name="loadId" className="select" required>
              <option value="">Select load</option>
              {loads.map((load) => (
                <option key={load.id} value={load.id}>
                  {load.loadNumber} - {load.customer.name} - {formatMoney(load.revenueCents)}
                </option>
              ))}
            </select>
            <button type="submit" className="btn">
              Generate Printable Invoice
            </button>
          </form>
        </section>

        <section className="card">
          <h2 className="section-title">Create Invoice</h2>
          <form action={createInvoice} className="mt-4 grid gap-3">
            <input name="invoiceNo" className="input" placeholder="INV-1003" required />
            <select name="loadId" className="select" required>
              <option value="">Select load</option>
              {loads.map((load) => (
                <option key={load.id} value={load.id}>
                  {load.loadNumber} - {load.customer.name}
                </option>
              ))}
            </select>
            <select name="status" className="select" defaultValue="DRAFT">
              {paymentStatuses.map((status) => (
                <option key={status} value={status}>
                  {humanize(status)}
                </option>
              ))}
            </select>
            <div className="grid gap-3 md:grid-cols-3">
              <input name="total" className="input" placeholder="Total" required />
              <input name="issuedAt" className="input" type="date" />
              <input name="dueAt" className="input" type="date" />
            </div>
            <button type="submit" className="btn">
              Save Invoice
            </button>
          </form>
        </section>

        <section className="card">
          <h2 className="section-title">Create Carrier Bill</h2>
          <form action={createCarrierBill} className="mt-4 grid gap-3">
            <input name="billNo" className="input" placeholder="CB-1003" required />
            <select name="loadId" className="select" required>
              <option value="">Select load</option>
              {loads.map((load) => (
                <option key={load.id} value={load.id}>
                  {load.loadNumber} - {load.customer.name}
                </option>
              ))}
            </select>
            <select name="carrierId" className="select" required>
              <option value="">Select carrier</option>
              {carriers.map((carrier) => (
                <option key={carrier.id} value={carrier.id}>
                  {carrier.name}
                </option>
              ))}
            </select>
            <select name="status" className="select" defaultValue="DRAFT">
              {paymentStatuses.map((status) => (
                <option key={status} value={status}>
                  {humanize(status)}
                </option>
              ))}
            </select>
            <div className="grid gap-3 md:grid-cols-3">
              <input name="total" className="input" placeholder="Total" required />
              <input name="receivedAt" className="input" type="date" />
              <input name="dueAt" className="input" type="date" />
            </div>
            <button type="submit" className="btn">
              Save Carrier Bill
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
