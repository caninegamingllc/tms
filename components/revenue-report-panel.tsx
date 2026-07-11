"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import { MetricCard } from "@/components/metric-card";
import {
  buildExportMeta,
  buildRevenueExportRows,
  exportRevenueCsv,
  exportRevenuePdf
} from "@/lib/export-reports";
import { formatDate, formatMoney, marginPercent } from "@/lib/format";
import type { RevenueSummary } from "@/lib/load-search";

export function SearchViewToggle({ view }: { view: "loads" | "revenue" }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function hrefFor(nextView: "loads" | "revenue") {
    const params = new URLSearchParams(searchParams.toString());
    if (nextView === "loads") {
      params.delete("view");
    } else {
      params.set("view", "revenue");
    }

    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  return (
    <div className="inline-flex rounded-lg border border-border bg-card p-1">
      <Link
        href={hrefFor("loads")}
        className={clsx(
          "rounded-md px-4 py-2 text-sm font-medium transition",
          view === "loads" ? "bg-lightprimary text-primary" : "text-muted-foreground hover:bg-muted"
        )}
      >
        Loads
      </Link>
      <Link
        href={hrefFor("revenue")}
        className={clsx(
          "rounded-md px-4 py-2 text-sm font-medium transition",
          view === "revenue" ? "bg-lightprimary text-primary" : "text-muted-foreground hover:bg-muted"
        )}
      >
        Revenue
      </Link>
    </div>
  );
}

export function RevenueReportPanel({
  summary,
  companyName,
  filterSummary
}: {
  summary: RevenueSummary;
  companyName: string;
  filterSummary: string;
}) {
  function handleExportCsv() {
    exportRevenueCsv({
      loads: buildRevenueExportRows(summary.loads),
      lanes: summary.lanes,
      customers: summary.customers,
      totalRevenueCents: summary.totalRevenueCents,
      marginCents: summary.marginCents,
      loadCount: summary.loadCount
    });
  }

  function handleExportPdf() {
    exportRevenuePdf(
      {
        loads: buildRevenueExportRows(summary.loads),
        lanes: summary.lanes,
        customers: summary.customers,
        totalRevenueCents: summary.totalRevenueCents,
        marginCents: summary.marginCents,
        loadCount: summary.loadCount,
        avgRevenueCents: summary.avgRevenueCents
      },
      buildExportMeta(companyName, "Revenue Report", filterSummary)
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="muted">{filterSummary}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={handleExportCsv}>
            Export CSV
          </button>
          <button type="button" className="btn-secondary" onClick={handleExportPdf}>
            Export PDF
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-4">
        <MetricCard
          label="Total Revenue"
          value={formatMoney(summary.totalRevenueCents)}
          detail="Filtered customer revenue"
        />
        <MetricCard
          label="Gross Margin"
          value={formatMoney(summary.marginCents)}
          detail={marginPercent(summary.totalRevenueCents, summary.totalCostCents)}
        />
        <MetricCard
          label="Load Count"
          value={summary.loadCount}
          detail="Matching current filters"
        />
        <MetricCard
          label="Avg Revenue / Load"
          value={formatMoney(summary.avgRevenueCents)}
          detail="Based on filtered results"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="card overflow-hidden p-0">
          <div className="border-b border-border p-5">
            <h2 className="section-title">Load Profitability</h2>
            <p className="muted">Revenue, carrier cost, and margin by load.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Load</th>
                  <th>Customer</th>
                  <th>Pickup</th>
                  <th>Revenue</th>
                  <th>Cost</th>
                  <th>Margin</th>
                </tr>
              </thead>
              <tbody>
                {summary.loads.length ? (
                  summary.loads.map((load) => (
                    <tr key={load.id}>
                      <td className="font-semibold">{load.loadNumber}</td>
                      <td>{load.customer}</td>
                      <td>{formatDate(load.pickupDate)}</td>
                      <td>{formatMoney(load.revenueCents)}</td>
                      <td>{formatMoney(load.costCents)}</td>
                      <td>
                        {formatMoney(load.marginCents)}
                        <p className="muted">{load.marginPercent}</p>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No loads match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card overflow-hidden p-0">
          <div className="border-b border-border p-5">
            <h2 className="section-title">Lane Summary</h2>
            <p className="muted">Freight flow by lane for the filtered set.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Lane</th>
                  <th>Loads</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {summary.lanes.length ? (
                  summary.lanes.map((lane) => (
                    <tr key={lane.lane}>
                      <td className="font-semibold">{lane.lane}</td>
                      <td>{lane.count}</td>
                      <td>{formatMoney(lane.revenueCents)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-muted-foreground">
                      No lane data for the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="card mt-6 overflow-hidden p-0">
        <div className="border-b border-border p-5">
          <h2 className="section-title">Customer Volume</h2>
          <p className="muted">Load counts and revenue by customer.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Loads</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {summary.customers.length ? (
                summary.customers.map((customer) => (
                  <tr key={customer.customer}>
                    <td className="font-semibold">{customer.customer}</td>
                    <td>{customer.count}</td>
                    <td>{formatMoney(customer.revenueCents)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-muted-foreground">
                    No customer data for the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
