"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import { MetricCard } from "@/components/metric-card";
import { SortableTable } from "@/components/sortable-table";
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
            <SortableTable
              data={summary.loads}
              keyExtractor={(load) => load.id}
              defaultSort={{ columnId: "pickup", direction: "desc" }}
              emptyMessage="No loads match the current filters."
              columns={[
                {
                  id: "load",
                  label: "Load",
                  sortValue: (load) => load.loadNumber,
                  render: (load) => <span className="font-semibold">{load.loadNumber}</span>
                },
                {
                  id: "customer",
                  label: "Customer",
                  sortValue: (load) => load.customer,
                  render: (load) => load.customer
                },
                {
                  id: "pickup",
                  label: "Pickup",
                  sortValue: (load) => load.pickupDate,
                  render: (load) => formatDate(load.pickupDate)
                },
                {
                  id: "revenue",
                  label: "Revenue",
                  sortValue: (load) => load.revenueCents,
                  render: (load) => formatMoney(load.revenueCents)
                },
                {
                  id: "cost",
                  label: "Cost",
                  sortValue: (load) => load.costCents,
                  render: (load) => formatMoney(load.costCents)
                },
                {
                  id: "margin",
                  label: "Margin",
                  sortValue: (load) => load.marginCents,
                  render: (load) => (
                    <>
                      {formatMoney(load.marginCents)}
                      <p className="muted">{load.marginPercent}</p>
                    </>
                  )
                }
              ]}
            />
          </div>
        </section>

        <section className="card overflow-hidden p-0">
          <div className="border-b border-border p-5">
            <h2 className="section-title">Lane Summary</h2>
            <p className="muted">Freight flow by lane for the filtered set.</p>
          </div>
          <div className="overflow-x-auto">
            <SortableTable
              data={summary.lanes}
              keyExtractor={(lane) => lane.lane}
              defaultSort={{ columnId: "revenue", direction: "desc" }}
              emptyMessage="No lane data for the current filters."
              columns={[
                {
                  id: "lane",
                  label: "Lane",
                  sortValue: (lane) => lane.lane,
                  render: (lane) => <span className="font-semibold">{lane.lane}</span>
                },
                {
                  id: "loads",
                  label: "Loads",
                  sortValue: (lane) => lane.count,
                  render: (lane) => lane.count
                },
                {
                  id: "revenue",
                  label: "Revenue",
                  sortValue: (lane) => lane.revenueCents,
                  render: (lane) => formatMoney(lane.revenueCents)
                }
              ]}
            />
          </div>
        </section>
      </div>

      <section className="card mt-6 overflow-hidden p-0">
        <div className="border-b border-border p-5">
          <h2 className="section-title">Customer Volume</h2>
          <p className="muted">Load counts and revenue by customer.</p>
        </div>
        <div className="overflow-x-auto">
          <SortableTable
            data={summary.customers}
            keyExtractor={(customer) => customer.customer}
            defaultSort={{ columnId: "revenue", direction: "desc" }}
            emptyMessage="No customer data for the current filters."
            columns={[
              {
                id: "customer",
                label: "Customer",
                sortValue: (customer) => customer.customer,
                render: (customer) => <span className="font-semibold">{customer.customer}</span>
              },
              {
                id: "loads",
                label: "Loads",
                sortValue: (customer) => customer.count,
                render: (customer) => customer.count
              },
              {
                id: "revenue",
                label: "Revenue",
                sortValue: (customer) => customer.revenueCents,
                render: (customer) => formatMoney(customer.revenueCents)
              }
            ]}
          />
        </div>
      </section>
    </>
  );
}
