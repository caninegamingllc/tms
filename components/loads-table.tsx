"use client";

import Link from "next/link";
import { SortableTable } from "@/components/sortable-table";
import { useUrlTableSort } from "@/components/url-table-sort";
import { StatusBadge } from "@/components/status-badge";
import { formatDate, formatMoney, marginPercent } from "@/lib/format";
import { DEFAULT_LOAD_SEARCH_SORT } from "@/lib/load-search";

export type LoadTableRow = {
  id: string;
  loadNumber: string;
  status: string;
  customerName: string;
  pickupCity: string;
  pickupState: string;
  deliveryCity: string;
  deliveryState: string;
  pickupDate: string;
  equipmentType: string;
  commodity: string | null;
  carrierName: string;
  revenueCents: number;
  carrierCostCents: number;
  commission: {
    branchShareCents: number;
    status: string;
  } | null;
};

export function LoadsTable({
  loads,
  paginated = true,
  serverSorted = false
}: {
  loads: LoadTableRow[];
  paginated?: boolean;
  /** When true, column sorts update the URL and the parent re-fetches the page. */
  serverSorted?: boolean;
}) {
  const urlSort = useUrlTableSort({
    columnId: DEFAULT_LOAD_SEARCH_SORT.column,
    direction: DEFAULT_LOAD_SEARCH_SORT.direction
  });

  return (
    <SortableTable
      tableId="loads"
      data={loads}
      paginated={paginated}
      keyExtractor={(load) => load.id}
      getRowHref={(load) => `/loads/${load.id}`}
      defaultSort={{
        columnId: DEFAULT_LOAD_SEARCH_SORT.column,
        direction: DEFAULT_LOAD_SEARCH_SORT.direction
      }}
      serverSort={
        serverSorted
          ? {
              columnId: urlSort.columnId,
              direction: urlSort.direction,
              onSort: urlSort.onSort
            }
          : undefined
      }
      emptyMessage="No loads found."
      columns={[
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
          sortValue: (load) => load.customerName,
          render: (load) => load.customerName
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
          sortValue: (load) => load.carrierName,
          render: (load) => load.carrierName
        },
        {
          id: "financials",
          label: "Financials",
          sortValue: (load) => load.revenueCents - load.carrierCostCents,
          render: (load) => (
            <>
              <p className="font-semibold">{formatMoney(load.revenueCents)}</p>
              <p className="muted">
                Margin {formatMoney(load.revenueCents - load.carrierCostCents)} (
                {marginPercent(load.revenueCents, load.carrierCostCents)})
              </p>
              {load.commission ? (
                <p className="mt-1 text-sm">
                  Commission {formatMoney(load.commission.branchShareCents)}{" "}
                  <StatusBadge value={load.commission.status} />
                </p>
              ) : null}
            </>
          )
        }
      ]}
    />
  );
}
