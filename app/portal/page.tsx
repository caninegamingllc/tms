import { CustomerPortalShell } from "@/components/customer-portal-shell";
import { CustomerDispatchBoard } from "@/components/customer-dispatch-board";
import { CustomerLoadMap } from "@/components/customer-load-map";
import { countCustomerRowsByStage } from "@/lib/customer-board";
import { resolveCustomerLoadMapMarkers } from "@/lib/customer-load-map";
import { formatMoney } from "@/lib/format";
import { requirePortalViewer } from "@/lib/portal-auth";
import { loadCustomerPortalBoardRows } from "@/lib/portal-queries";
import { prisma } from "@/lib/db";

export default async function PortalOverviewPage() {
  const viewer = await requirePortalViewer();
  const [rows, markers, invoiceSummary] = await Promise.all([
    loadCustomerPortalBoardRows(viewer),
    resolveCustomerLoadMapMarkers({
      companyId: viewer.companyId,
      customerId: viewer.customerId
    }),
    prisma.invoice.findMany({
      where: {
        companyId: viewer.companyId,
        customerId: viewer.customerId,
        status: { not: "VOID" }
      },
      select: { status: true, balanceCents: true, totalCents: true }
    })
  ]);

  const counts = countCustomerRowsByStage(rows);
  const openInvoices = invoiceSummary.filter(
    (invoice) => invoice.status !== "PAID" && invoice.balanceCents > 0
  );
  const openBalance = openInvoices.reduce((sum, invoice) => sum + invoice.balanceCents, 0);

  return (
    <CustomerPortalShell viewer={viewer}>
      <div className="grid gap-8">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Overview
          </p>
          <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight">Your shipments</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Track active loads, follow locations from check calls, and review invoices — without carrier
            pay or margin details.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: "Active", value: counts.active },
            { label: "En route", value: counts.en_route },
            { label: "Completed", value: counts.completed },
            { label: "Open invoices", value: openInvoices.length },
            { label: "Open balance", value: formatMoney(openBalance) }
          ].map((metric) => (
            <div key={metric.label} className="rounded-2xl border border-border bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {metric.label}
              </p>
              <p className="mt-2 font-display text-2xl font-semibold">{metric.value}</p>
            </div>
          ))}
        </div>

        <section className="grid gap-3">
          <div>
            <h2 className="section-title">Load map</h2>
            <p className="muted">
              Icons start at pickup, move with check-call locations, and snap to delivery when marked
              delivered.
            </p>
          </div>
          <CustomerLoadMap markers={markers} />
        </section>

        <section className="grid gap-3">
          <div>
            <h2 className="section-title">Dispatch board</h2>
            <p className="muted">Your loads only — carrier assignment and status, no private financials.</p>
          </div>
          <CustomerDispatchBoard rows={rows} stage="all" basePath="/portal/board" />
        </section>
      </div>
    </CustomerPortalShell>
  );
}
