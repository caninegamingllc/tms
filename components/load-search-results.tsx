"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { clsx } from "clsx";
import { useSortedRows, type SortableColumn } from "@/components/sortable-table";
import { StatusBadge } from "@/components/status-badge";
import {
  buildExportMeta,
  buildLoadExportRows,
  exportLoadsCsv,
  exportLoadsPdf
} from "@/lib/export-reports";
import { formatDate, formatMoney, marginPercent } from "@/lib/format";

export type SerializedSearchLoad = {
  id: string;
  loadNumber: string;
  title: string;
  status: string;
  customer: string;
  pickupCity: string;
  pickupState: string;
  deliveryCity: string;
  deliveryState: string;
  pickupDate: string;
  equipmentType: string;
  commodity: string | null;
  carrier: string;
  revenueCents: number;
  carrierCostCents: number;
  marginCents: number;
};

const columns: SortableColumn<SerializedSearchLoad>[] = [
  {
    id: "select",
    label: "",
    sortable: false,
    render: () => null
  },
  {
    id: "load",
    label: "Load",
    sortValue: (load) => load.loadNumber,
    render: (load) => (
      <>
        <Link href={`/loads/${load.id}`} className="font-semibold text-primary">
          {load.loadNumber}
        </Link>
        <p className="muted">{load.title}</p>
      </>
    )
  },
  {
    id: "status",
    label: "Status",
    sortValue: (load) => load.status,
    render: (load) => <StatusBadge value={load.status} />
  },
  {
    id: "customer",
    label: "Customer",
    sortValue: (load) => load.customer,
    render: (load) => load.customer
  },
  {
    id: "lane",
    label: "Lane",
    sortValue: (load) => `${load.pickupCity}, ${load.pickupState} to ${load.deliveryCity}, ${load.deliveryState}`,
    render: (load) => (
      <>
        {load.pickupCity}, {load.pickupState} to {load.deliveryCity}, {load.deliveryState}
      </>
    )
  },
  {
    id: "pickup",
    label: "Pickup",
    sortValue: (load) => load.pickupDate,
    render: (load) => formatDate(load.pickupDate)
  },
  {
    id: "equipment",
    label: "Equipment",
    sortValue: (load) => load.equipmentType,
    render: (load) => load.equipmentType
  },
  {
    id: "commodity",
    label: "Commodity",
    sortValue: (load) => load.commodity ?? "General freight",
    render: (load) => load.commodity ?? "General freight"
  },
  {
    id: "carrier",
    label: "Carrier",
    sortValue: (load) => load.carrier,
    render: (load) => load.carrier
  },
  {
    id: "financials",
    label: "Financials",
    sortValue: (load) => load.marginCents,
    render: (load) => (
      <>
        <p className="font-semibold">{formatMoney(load.revenueCents)}</p>
        <p className="muted">
          Margin {formatMoney(load.marginCents)} ({marginPercent(load.revenueCents, load.carrierCostCents)})
        </p>
      </>
    )
  }
];

export function LoadSearchResults({
  loads,
  companyName,
  filterSummary
}: {
  loads: SerializedSearchLoad[];
  companyName: string;
  filterSummary: string;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(loads.map((load) => load.id)));
  const { sortedData, sortState, handleSort } = useSortedRows(loads, columns, {
    columnId: "pickup",
    direction: "desc"
  });

  const allSelected = loads.length > 0 && selectedIds.size === loads.length;
  const selectedLoads = useMemo(
    () => loads.filter((load) => selectedIds.has(load.id)),
    [loads, selectedIds]
  );

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }

    setSelectedIds(new Set(loads.map((load) => load.id)));
  }

  function toggleOne(loadId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(loadId)) {
        next.delete(loadId);
      } else {
        next.add(loadId);
      }
      return next;
    });
  }

  function handleExportCsv() {
    const rows = buildLoadExportRows(selectedLoads);
    exportLoadsCsv(rows);
  }

  function handleExportPdf() {
    const rows = buildLoadExportRows(selectedLoads);
    exportLoadsPdf(rows, buildExportMeta(companyName, "Loads Report", filterSummary));
  }

  return (
    <section className="card overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
        <div>
          <h2 className="section-title">Load Results</h2>
          <p className="muted">
            {loads.length} load{loads.length === 1 ? "" : "s"} found · {filterSummary}
          </p>
          <p className="muted">{selectedLoads.length} selected for export</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={handleExportCsv}
            disabled={!selectedLoads.length}
          >
            Export CSV
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleExportPdf}
            disabled={!selectedLoads.length}
          >
            Export PDF
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  aria-label="Select all loads"
                  checked={allSelected}
                  onChange={toggleAll}
                />
              </th>
              {columns.slice(1).map((column) => {
                const isSortable = column.sortable !== false && column.sortValue != null;
                const isActive = sortState.columnId === column.id;

                return (
                  <th
                    key={column.id}
                    className={clsx(isSortable && "sortable", column.headerClassName)}
                    data-active={isActive || undefined}
                    aria-sort={
                      isSortable
                        ? isActive
                          ? sortState.direction === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                        : undefined
                    }
                  >
                    {isSortable ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-left"
                        onClick={() => handleSort(column.id)}
                      >
                        <span>{column.label}</span>
                        {isActive ? (
                          sortState.direction === "asc" ? (
                            <ArrowUp className="sort-icon" aria-hidden="true" />
                          ) : (
                            <ArrowDown className="sort-icon" aria-hidden="true" />
                          )
                        ) : (
                          <ChevronsUpDown className="sort-icon" aria-hidden="true" />
                        )}
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedData.length ? (
              sortedData.map((load) => (
                <tr key={load.id}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Select load ${load.loadNumber}`}
                      checked={selectedIds.has(load.id)}
                      onChange={() => toggleOne(load.id)}
                    />
                  </td>
                  {columns.slice(1).map((column) => (
                    <td key={column.id}>{column.render(load)}</td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="p-8 text-center text-muted-foreground">
                  No loads match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
