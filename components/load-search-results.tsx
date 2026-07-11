"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
    exportLoadsPdf(
      rows,
      buildExportMeta(companyName, "Loads Report", filterSummary)
    );
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
              <th>Load</th>
              <th>Status</th>
              <th>Customer</th>
              <th>Lane</th>
              <th>Pickup</th>
              <th>Equipment</th>
              <th>Commodity</th>
              <th>Carrier</th>
              <th>Financials</th>
            </tr>
          </thead>
          <tbody>
            {loads.length ? (
              loads.map((load) => (
                <tr key={load.id}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Select load ${load.loadNumber}`}
                      checked={selectedIds.has(load.id)}
                      onChange={() => toggleOne(load.id)}
                    />
                  </td>
                  <td>
                    <Link href={`/loads/${load.id}`} className="font-semibold text-primary">
                      {load.loadNumber}
                    </Link>
                    <p className="muted">{load.title}</p>
                  </td>
                  <td>
                    <StatusBadge value={load.status} />
                  </td>
                  <td>{load.customer}</td>
                  <td>
                    {load.pickupCity}, {load.pickupState} to {load.deliveryCity}, {load.deliveryState}
                  </td>
                  <td>{formatDate(load.pickupDate)}</td>
                  <td>{load.equipmentType}</td>
                  <td>{load.commodity ?? "General freight"}</td>
                  <td>{load.carrier}</td>
                  <td>
                    <p className="font-semibold">{formatMoney(load.revenueCents)}</p>
                    <p className="muted">
                      Margin {formatMoney(load.marginCents)} (
                      {marginPercent(load.revenueCents, load.carrierCostCents)})
                    </p>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={10} className="p-8 text-center text-muted-foreground">
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
