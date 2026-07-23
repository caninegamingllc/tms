import Link from "next/link";
import { after } from "next/server";
import {
  AccountingBillsPanel,
  AccountingInvoicesPanel
} from "@/components/accounting-bulk-tables";
import { AccountingAgingReport } from "@/components/accounting-aging-report";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { DatePicker } from "@/components/ui/date-picker";
import { TileBoard, Tile } from "@/components/tile-board";
import { createInvoice, generateCustomerInvoice } from "@/lib/actions";
import { recomputeOverdueStatuses } from "@/lib/accounting-actions";
import { getBranchScope } from "@/lib/branch-filter-server";
import { requirePlanFeature } from "@/lib/permissions";
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
import { ACCOUNTING_TILES } from "@/lib/tile-defaults";
import { loadPageLayoutContext } from "@/lib/ui-preferences-load";

const TABS = [
  { id: "invoices", label: "Invoices" },
  { id: "bills", label: "Bills" },
  { id: "report", label: "AR/AP Report" }
] as const;

type TabId = (typeof TABS)[number]["id"];

function resolveTab(value?: string): TabId {
  if (value === "bills" || value === "report") {
    return value;
  }
  return "invoices";
}

function formatRemitTo(parts: {
  payeeName?: string | null;
  nameOnCheck?: string | null;
  factorName?: string | null;
  carrierName: string;
}) {
  return parts.payeeName || parts.factorName || parts.nameOnCheck || parts.carrierName;
}

export default async function AccountingPage({
  searchParams
}: {
  searchParams: Promise<{
    tab?: string;
    reconciled?: string;
    invoices?: string;
    bills?: string;
    error?: string;
    paymentReceived?: string;
    paymentRecorded?: string;
    emailed?: string;
    qbPushed?: string;
    billSaved?: string;
  }>;
}) {
  const user = await requirePlanFeature("accounting_ar_ap");
  const params = await searchParams;
  const tab = resolveTab(params.tab);
  const loadScope = await getBranchScope(user);
  const quickbooksMethod = await getCompanyQuickbooksMethod(user.companyId);
  const activeExportMethod: AccountingExportMethod | null =
    quickbooksMethod === "ONLINE" || quickbooksMethod === "IIF" ? quickbooksMethod : null;

  after(() => {
    void recomputeOverdueStatuses(user.companyId);
  });

  const [loads, invoices, carrierBills, qboAccount, layoutContext] = await Promise.all([
    prisma.load.findMany({
      where: loadScope,
      orderBy: { loadNumber: "desc" },
      include: {
        customer: true,
        expenses: true,
        dispatchAssignments: {
          orderBy: { sequence: "asc" },
          include: {
            carrier: { include: { factoringCompany: true } }
          }
        },
        stops: { orderBy: { sequence: "asc" } },
        carrierBills: {
          include: { factoringCompany: true },
          orderBy: { createdAt: "desc" }
        }
      }
    }),
    prisma.invoice.findMany({
      where: { companyId: user.companyId, load: loadScope },
      orderBy: { createdAt: "desc" },
      include: {
        customer: true,
        load: {
          include: {
            commission: true,
            stops: { orderBy: { sequence: "asc" } }
          }
        }
      }
    }),
    prisma.carrierBill.findMany({
      where: { companyId: user.companyId, load: loadScope },
      orderBy: { createdAt: "desc" },
      include: { carrier: true, load: true, factoringCompany: true }
    }),
    prisma.integrationAccount.findUnique({
      where: {
        companyId_provider: { companyId: user.companyId, provider: "QUICKBOOKS" }
      }
    }),
    loadPageLayoutContext("accounting")
  ]);

  // In-memory repair for bad rows (balance wiped while still open). Persist after response.
  const balanceRepairs: Array<() => Promise<unknown>> = [];
  for (const invoice of invoices) {
    if (
      invoice.balanceCents === 0 &&
      invoice.status !== "PAID" &&
      invoice.status !== "VOID" &&
      invoice.totalCents > 0
    ) {
      const totalCents = invoice.totalCents;
      invoice.balanceCents = totalCents;
      balanceRepairs.push(() =>
        prisma.invoice.update({
          where: { id: invoice.id },
          data: { balanceCents: totalCents }
        })
      );
    }
  }
  for (const bill of carrierBills) {
    if (
      bill.balanceCents === 0 &&
      bill.status !== "PAID" &&
      bill.status !== "VOID" &&
      bill.totalCents > 0
    ) {
      const totalCents = bill.totalCents;
      const payeeName = bill.payeeName ?? bill.carrier.name;
      const nameOnCheck = bill.nameOnCheck ?? bill.carrier.name;
      bill.balanceCents = totalCents;
      bill.payeeName = payeeName;
      bill.nameOnCheck = nameOnCheck;
      balanceRepairs.push(() =>
        prisma.carrierBill.update({
          where: { id: bill.id },
          data: { balanceCents: totalCents, payeeName, nameOnCheck }
        })
      );
    }
  }
  if (balanceRepairs.length > 0) {
    after(() => {
      void Promise.all(balanceRepairs.map((run) => run()));
    });
  }

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

  const openArAgg = await prisma.invoice.aggregate({
    where: { companyId: user.companyId, load: loadScope, status: { not: "VOID" } },
    _sum: { balanceCents: true }
  });
  const openApAgg = await prisma.carrierBill.aggregate({
    where: { companyId: user.companyId, load: loadScope, status: { not: "VOID" } },
    _sum: { balanceCents: true }
  });
  const loadMoneyAgg = await prisma.load.aggregate({
    where: loadScope,
    _sum: { revenueCents: true, carrierCostCents: true }
  });
  const openAr = openArAgg._sum.balanceCents ?? 0;
  const openAp = openApAgg._sum.balanceCents ?? 0;
  const grossMargin =
    (loadMoneyAgg._sum.revenueCents ?? 0) - (loadMoneyAgg._sum.carrierCostCents ?? 0);

  const qboConnected = qboAccount?.status === "Connected";
  const method: QuickbooksMethod = quickbooksMethod;
  const showQuickbooks = method !== "NONE";
  const tiles = showQuickbooks
    ? ACCOUNTING_TILES
    : ACCOUNTING_TILES.filter((tile) => tile.id !== "quickbooks");

  const invoiceRows = invoices.map((invoice) => {
    const exportView = activeExportMethod
      ? toExportStatusView(activeExportMethod, invoiceExports.get(invoice.id) ?? null)
      : null;
    const deliveryStop = [...invoice.load.stops].reverse().find((stop) => stop.type === "DELIVERY");
    return {
      id: invoice.id,
      invoiceNo: invoice.invoiceNo,
      loadId: invoice.loadId,
      loadNumber: invoice.load.loadNumber,
      referenceNumber: invoice.load.referenceNumber ?? null,
      customerId: invoice.customerId,
      customerName: invoice.customer.name,
      status: invoice.status,
      totalCents: invoice.totalCents,
      balanceCents: invoice.balanceCents,
      issuedAt: invoice.issuedAt?.toISOString() ?? null,
      dueAt: invoice.dueAt?.toISOString() ?? null,
      deliveryAt:
        deliveryStop?.appointmentAt?.toISOString() ??
        invoice.load.deliveryDate?.toISOString() ??
        null,
      sentLabel:
        invoice.status === "SENT" ||
        invoice.status === "PARTIAL" ||
        invoice.status === "OVERDUE" ||
        invoice.status === "PAID"
          ? invoice.issuedAt
            ? `Sent On ${invoice.issuedAt.toLocaleDateString()}`
            : "Sent"
          : "Unsent",
      exportLabel: exportView?.label ?? null,
      canMarkPaid: invoice.balanceCents > 0 && invoice.status !== "VOID",
      canPushOnline: method === "ONLINE" && qboConnected && invoice.status !== "VOID"
    };
  });

  const apLoadRows = loads.flatMap((load) => {
    const withCarrier = load.dispatchAssignments.filter((row) => row.carrier != null);
    if (!withCarrier.length) {
      return [];
    }

    const deliveryStop = [...load.stops].reverse().find((stop) => stop.type === "DELIVERY");
    const loadExpenseBase = load.expenses.reduce((sum, expense) => sum + expense.amountCents, 0);

    return withCarrier.map((assignment) => {
      const carrier = assignment.carrier!;
      const bill =
        load.carrierBills.find(
          (entry) => entry.carrierId === carrier.id && entry.status !== "VOID"
        ) ?? null;
      const exportView =
        bill && activeExportMethod
          ? toExportStatusView(activeExportMethod, billExports.get(bill.id) ?? null)
          : null;
      const expenseCents = (assignment.rateCents ?? 0) + loadExpenseBase;

      return {
        rowKey: bill?.id ?? `load-${load.id}-carrier-${carrier.id}`,
        loadId: load.id,
        loadNumber: load.loadNumber,
        loadStatus: load.status,
        referenceNumber: load.referenceNumber ?? null,
        carrierId: carrier.id,
        carrierName: carrier.name,
        deliveryAt:
          deliveryStop?.appointmentAt?.toISOString() ?? load.deliveryDate?.toISOString() ?? null,
        loadExpenseCents: expenseCents,
        billId: bill?.id ?? null,
        billNo: bill?.billNo ?? null,
        billReference: bill?.billReference ?? null,
        billStatus: bill?.status ?? null,
        receivedAt: bill?.receivedAt?.toISOString() ?? null,
        dueAt: bill?.dueAt?.toISOString() ?? null,
        amountBilledCents: bill?.totalCents ?? 0,
        balanceCents: bill?.balanceCents ?? 0,
        remitTo: formatRemitTo({
          payeeName: bill?.payeeName,
          nameOnCheck: bill?.nameOnCheck,
          factorName: bill?.factoringCompany?.name ?? carrier.factoringCompany?.name,
          carrierName: carrier.name
        }),
        exportLabel: exportView?.label ?? null,
        canMarkPaid: Boolean(bill && bill.balanceCents > 0 && bill.status !== "VOID"),
        canPushOnline: Boolean(
          bill && method === "ONLINE" && qboConnected && bill.status !== "VOID"
        )
      };
    });
  });

  const arReportRows = invoices
    .filter((invoice) => invoice.balanceCents > 0 && invoice.status !== "VOID")
    .map((invoice) => ({
      id: invoice.id,
      entityName: invoice.customer.name,
      invoiceNo: invoice.invoiceNo,
      loadId: invoice.loadId,
      loadNumber: invoice.load.loadNumber,
      referenceNumber: invoice.load.referenceNumber ?? null,
      paymentTerms: invoice.customer.paymentTerms,
      issuedAt: invoice.issuedAt?.toISOString() ?? null,
      dueAt: invoice.dueAt?.toISOString() ?? null,
      totalCents: invoice.totalCents,
      paidCents: Math.max(0, invoice.totalCents - invoice.balanceCents),
      balanceCents: invoice.balanceCents
    }));

  const apReportRows = carrierBills
    .filter((bill) => bill.balanceCents > 0 && bill.status !== "VOID")
    .map((bill) => ({
      id: bill.id,
      entityName: bill.payeeName ?? bill.factoringCompany?.name ?? bill.carrier.name,
      billNo: bill.billNo,
      loadId: bill.loadId,
      loadNumber: bill.load.loadNumber,
      referenceNumber: bill.billReference ?? null,
      paymentTerms:
        bill.paymentTermsDays != null ? `Net ${bill.paymentTermsDays}` : bill.carrier.paymentTerms,
      issuedAt: bill.receivedAt?.toISOString() ?? null,
      dueAt: bill.dueAt?.toISOString() ?? null,
      totalCents: bill.totalCents,
      paidCents: Math.max(0, bill.totalCents - bill.balanceCents),
      balanceCents: bill.balanceCents
    }));

  return (
    <>
      <PageHeader
        title="Accounting"
        description="Manage customer invoices, carrier bills, aging, receivables, payables, and QuickBooks export."
      />

      {params.error ? (
        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          {params.error}
        </div>
      ) : null}
      {params.reconciled ? (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          Reconciled {params.invoices ?? "0"} invoice(s) and {params.bills ?? "0"} bill(s) from QuickBooks
          Online.
        </div>
      ) : null}
      {params.paymentReceived ? (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          Customer payment applied.
        </div>
      ) : null}
      {params.paymentRecorded ? (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          Carrier bill payment recorded.
        </div>
      ) : null}
      {params.billSaved ? (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          Carrier bill saved.
        </div>
      ) : null}
      {params.emailed ? (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          Emailed {params.emailed} invoice(s).
        </div>
      ) : null}
      {params.qbPushed ? (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          Pushed {params.qbPushed} document(s) to QuickBooks.
        </div>
      ) : null}

      <TileBoard
        pageId="accounting"
        tiles={tiles}
        initialLayouts={layoutContext.layouts}
        orgDefaultLayouts={layoutContext.orgDefaultLayouts}
        canSetOrgDefault={layoutContext.canSetOrgDefault}
      >
        {showQuickbooks ? (
          <Tile id="quickbooks">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className="muted">
                Active method:{" "}
                <span className="font-semibold text-foreground">
                  {method === "ONLINE" ? "QuickBooks Online" : "IIF (Desktop)"}
                </span>
                .
              </p>
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
          </Tile>
        ) : null}

        <Tile id="metrics">
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="grid md:grid-cols-3 md:[&>*:nth-child(3n)]:border-r-0">
              <MetricCard label="Open AR" value={formatMoney(openAr)} detail="Customer invoice balances" />
              <MetricCard label="Open AP" value={formatMoney(openAp)} detail="Carrier bill balances" />
              <MetricCard
                label="Gross Margin"
                value={formatMoney(grossMargin)}
                detail="Revenue minus carrier cost"
              />
            </div>
          </div>
        </Tile>

        <Tile id="main">
          <div className="grid gap-6">
            <div className="flex flex-wrap gap-2 border-b border-border pb-3">
              {TABS.map((item) => (
                <Link
                  key={item.id}
                  href={`/accounting?tab=${item.id}`}
                  className={
                    tab === item.id
                      ? "rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                      : "rounded-full bg-muted px-4 py-2 text-sm font-semibold text-foreground"
                  }
                >
                  {item.label}
                </Link>
              ))}
            </div>

            {tab === "invoices" ? (
              <div className="grid gap-6">
                <div>
                  <p className="mb-3 text-[15px] font-semibold text-foreground">Customer Invoices</p>
                  <p className="muted mb-4">
                    Click column headers to sort. Select invoices for bulk email, payment receipt, or
                    QuickBooks export.
                  </p>
                  <AccountingInvoicesPanel invoices={invoiceRows} quickbooksMethod={method} />
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-[15px] font-semibold text-foreground">
                      Generate Customer Invoice Document
                    </p>
                    <p className="muted">Create a printable invoice from the selected load.</p>
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
                  </div>

                  <div className="rounded-lg border border-border p-4">
                    <p className="text-[15px] font-semibold text-foreground">Create Invoice</p>
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
                        <DatePicker name="issuedAt" placeholder="Issued date" clearable />
                        <DatePicker name="dueAt" placeholder="Due date" clearable />
                      </div>
                      <button type="submit" className="btn">
                        Save Invoice
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ) : null}

            {tab === "bills" ? (
              <div>
                <p className="mb-3 text-[15px] font-semibold text-foreground">Carrier Bills</p>
                <p className="muted mb-4">
                  Covered loads appear here. Expand a row to record a carrier invoice, or select billed
                  rows to edit, pay, or export. Click column headers to sort.
                </p>
                <AccountingBillsPanel rows={apLoadRows} quickbooksMethod={method} />
              </div>
            ) : null}

            {tab === "report" ? (
              <AccountingAgingReport arRows={arReportRows} apRows={apReportRows} />
            ) : null}
          </div>
        </Tile>
      </TileBoard>
    </>
  );
}
