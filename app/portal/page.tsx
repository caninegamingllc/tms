import { CustomerPortalShell } from "@/components/customer-portal-shell";
import { CustomerDispatchBoard } from "@/components/customer-dispatch-board";
import { CustomerLoadMapLazy } from "@/components/customer-load-map-lazy";
import { countCustomerRowsByStage } from "@/lib/customer-board";
import { resolveCustomerLoadMapMarkers } from "@/lib/customer-load-map";
import { formatMoney } from "@/lib/format";
import { requirePortalViewer } from "@/lib/portal-auth";
import { loadCustomerPortalBoardRows } from "@/lib/portal-queries";
import { prisma } from "@/lib/db";

export default async function PortalOverviewPage() {
  // #region agent log
  fetch("http://127.0.0.1:7764/ingest/14c39c80-17b4-4dcd-8347-dae6ec7f550a", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "9554aa" },
    body: JSON.stringify({
      sessionId: "9554aa",
      runId: "pre-fix",
      hypothesisId: "B",
      location: "app/portal/page.tsx:entry",
      message: "portal overview enter",
      data: {},
      timestamp: Date.now()
    })
  }).catch(() => {});
  // #endregion

  const viewer = await requirePortalViewer();
  // #region agent log
  fetch("http://127.0.0.1:7764/ingest/14c39c80-17b4-4dcd-8347-dae6ec7f550a", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "9554aa" },
    body: JSON.stringify({
      sessionId: "9554aa",
      runId: "pre-fix",
      hypothesisId: "B",
      location: "app/portal/page.tsx:viewer",
      message: "portal viewer resolved",
      data: {
        accessMode: viewer.accessMode,
        hasCompany: Boolean(viewer.companyId),
        hasCustomer: Boolean(viewer.customerId)
      },
      timestamp: Date.now()
    })
  }).catch(() => {});
  // #endregion

  const startedAt = Date.now();
  let rows;
  let markers;
  let invoiceSummary;
  try {
    const boardStarted = Date.now();
    const boardPromise = loadCustomerPortalBoardRows(viewer).then((value) => {
      // #region agent log
      fetch("http://127.0.0.1:7764/ingest/14c39c80-17b4-4dcd-8347-dae6ec7f550a", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "9554aa" },
        body: JSON.stringify({
          sessionId: "9554aa",
          runId: "pre-fix",
          hypothesisId: "B",
          location: "app/portal/page.tsx:board",
          message: "board rows loaded",
          data: { ms: Date.now() - boardStarted, rowCount: value.length },
          timestamp: Date.now()
        })
      }).catch(() => {});
      // #endregion
      return value;
    });

    const mapStarted = Date.now();
    const mapPromise = resolveCustomerLoadMapMarkers({
      companyId: viewer.companyId,
      customerId: viewer.customerId
    }).then((value) => {
      // #region agent log
      fetch("http://127.0.0.1:7764/ingest/14c39c80-17b4-4dcd-8347-dae6ec7f550a", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "9554aa" },
        body: JSON.stringify({
          sessionId: "9554aa",
          runId: "pre-fix",
          hypothesisId: "C",
          location: "app/portal/page.tsx:map",
          message: "map markers loaded",
          data: { ms: Date.now() - mapStarted, markerCount: value.length },
          timestamp: Date.now()
        })
      }).catch(() => {});
      // #endregion
      return value;
    });

    const invoiceStarted = Date.now();
    const invoicePromise = prisma.invoice
      .findMany({
        where: {
          companyId: viewer.companyId,
          customerId: viewer.customerId,
          status: { not: "VOID" }
        },
        select: { status: true, balanceCents: true, totalCents: true }
      })
      .then((value) => {
        // #region agent log
        fetch("http://127.0.0.1:7764/ingest/14c39c80-17b4-4dcd-8347-dae6ec7f550a", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "9554aa" },
          body: JSON.stringify({
            sessionId: "9554aa",
            runId: "pre-fix",
            hypothesisId: "B",
            location: "app/portal/page.tsx:invoices",
            message: "invoices loaded",
            data: { ms: Date.now() - invoiceStarted, invoiceCount: value.length },
            timestamp: Date.now()
          })
        }).catch(() => {});
        // #endregion
        return value;
      });

    [rows, markers, invoiceSummary] = await Promise.all([boardPromise, mapPromise, invoicePromise]);
  } catch (error) {
    // #region agent log
    fetch("http://127.0.0.1:7764/ingest/14c39c80-17b4-4dcd-8347-dae6ec7f550a", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "9554aa" },
      body: JSON.stringify({
        sessionId: "9554aa",
        runId: "pre-fix",
        hypothesisId: "B",
        location: "app/portal/page.tsx:Promise.all",
        message: "portal overview data load failed",
        data: {
          ms: Date.now() - startedAt,
          errorName: error instanceof Error ? error.name : "unknown",
          errorMessage: error instanceof Error ? error.message : String(error)
        },
        timestamp: Date.now()
      })
    }).catch(() => {});
    // #endregion
    throw error;
  }

  // #region agent log
  fetch("http://127.0.0.1:7764/ingest/14c39c80-17b4-4dcd-8347-dae6ec7f550a", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "9554aa" },
    body: JSON.stringify({
      sessionId: "9554aa",
      runId: "pre-fix",
      hypothesisId: "C",
      location: "app/portal/page.tsx:success",
      message: "portal overview data load success",
      data: {
        ms: Date.now() - startedAt,
        rowCount: rows.length,
        markerCount: markers.length,
        invoiceCount: invoiceSummary.length
      },
      timestamp: Date.now()
    })
  }).catch(() => {});
  // #endregion

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
              delivered. Invoiced and paid loads drop off the map.
            </p>
          </div>
          <CustomerLoadMapLazy markers={markers} />
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
