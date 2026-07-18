"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  navigateFromRowClick,
  navigateFromRowKeyDown,
  useSortedRows,
  useClientPagination,
  useOrderedColumns,
  SortableTableHeader,
  ColumnLayoutControls,
  getResizableTableStyle,
  type SortableColumn
} from "@/components/sortable-table";
import { TablePagination } from "@/components/table-pagination";
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

const baseColumns: SortableColumn<SerializedSearchLoad>[] = [
  {
    id: "select",
    label: "",
    sortable: false,
    reorderable: false,
    render: () => null
  },
  {
    id: "load",
    label: "Load",
    sortValue: (load) => load.loadNumber,
    render: (load) => (
      <Link href={`/loads/${load.id}`} className="font-semibold text-primary">
        {load.loadNumber}
      </Link>
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
    sortValue: (load) =>
      `${load.pickupCity}, ${load.pickupState} to ${load.deliveryCity}, ${load.deliveryState}`,
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
  filterSummary,
  serverTotal
}: {
  loads: SerializedSearchLoad[];
  companyName: string;
  filterSummary: string;
  /** When set, this page of loads is already server-paginated — skip client paging. */
  serverTotal?: number;
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(loads.map((load) => load.id)));
  const {
    orderedColumns,
    moveColumn,
    resetLayout,
    isLayoutCustomized,
    columnWidths,
    setColumnWidth
  } = useOrderedColumns("load-search", baseColumns);
  const { sortedData, sortState, handleSort } = useSortedRows(loads, orderedColumns, {
    columnId: "pickup",
    direction: "desc"
  });
  const clientPagination = useClientPagination(sortedData, loads);
  const useServerPaging = typeof serverTotal === "number";
  const pageRows = useServerPaging ? sortedData : clientPagination.pageRows;
  const displayTotal = useServerPaging ? serverTotal : loads.length;
  const pageIds = pageRows.map((load) => load.id);

  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const selectedLoads = useMemo(
    () => loads.filter((load) => selectedIds.has(load.id)),
    [loads, selectedIds]
  );

  function toggleAllPage() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allPageSelected) {
        for (const id of pageIds) {
          next.delete(id);
        }
      } else {
        for (const id of pageIds) {
          next.add(id);
        }
      }
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const headerColumns = orderedColumns.map((column) =>
    column.id === "select"
      ? {
          ...column,
          label: (
            <input
              type="checkbox"
              aria-label="Select all loads on this page"
              checked={allPageSelected}
              disabled={pageIds.length === 0}
              onChange={toggleAllPage}
            />
          )
        }
      : column
  );

  function handleExportCsv() {
    exportLoadsCsv(buildLoadExportRows(selectedLoads));
  }

  function handleExportPdf() {
    exportLoadsPdf(
      buildLoadExportRows(selectedLoads),
      buildExportMeta(companyName, "Load search results", filterSummary)
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="muted">
          {selectedLoads.length} of {displayTotal} loads selected
          {useServerPaging ? " on this page / matching filters" : ""}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <ColumnLayoutControls
            className="mb-0"
            onReset={resetLayout}
            isCustomized={isLayoutCustomized}
          />
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
        <table className="table" style={getResizableTableStyle(headerColumns, columnWidths)}>
          <SortableTableHeader
            columns={headerColumns}
            sortState={sortState}
            onSort={handleSort}
            columnReorder
            onMoveColumn={moveColumn}
            columnWidths={columnWidths}
            onColumnResize={setColumnWidth}
          />
          <tbody>
            {pageRows.length ? (
              pageRows.map((load) => {
                const href = `/loads/${load.id}`;

                return (
                  <tr
                    key={load.id}
                    className="table-row-link"
                    tabIndex={0}
                    onClick={(event) => navigateFromRowClick(event, href, router.push)}
                    onKeyDown={(event) => navigateFromRowKeyDown(event, href, router.push)}
                  >
                    {orderedColumns.map((column) =>
                      column.id === "select" ? (
                        <td key={column.id}>
                          <input
                            type="checkbox"
                            aria-label={`Select load ${load.loadNumber}`}
                            checked={selectedIds.has(load.id)}
                            onChange={() => toggleOne(load.id)}
                          />
                        </td>
                      ) : (
                        <td key={column.id}>{column.render(load)}</td>
                      )
                    )}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={orderedColumns.length} className="p-8 text-center text-muted-foreground">
                  No loads match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!useServerPaging ? (
        <TablePagination
          page={clientPagination.page}
          pageSize={clientPagination.pageSize}
          total={clientPagination.total}
          totalPages={clientPagination.totalPages}
          start={clientPagination.start}
          end={clientPagination.end}
          onPageChange={clientPagination.setPage}
          onPageSizeChange={clientPagination.setPageSize}
        />
      ) : null}
    </div>
  );
}
