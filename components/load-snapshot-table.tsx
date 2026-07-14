"use client";

import Link from "next/link";
import { SortableTable } from "@/components/sortable-table";
import { StatusBadge } from "@/components/status-badge";
import { formatDate, formatMoney, marginPercent } from "@/lib/format";

export type LoadSnapshotRow = {
  id: string;
  loadNumber: string;
  equipmentType: string;
  customerName: string;
  pickupCity: string;
  pickupState: string;
  deliveryCity: string;
  deliveryState: string;
  pickupDate: string;
  status: string;
  revenueCents: number;
  carrierCostCents: number;
};

export function LoadSnapshotTable({ loads }: { loads: LoadSnapshotRow[] }) {
  return (
    <SortableTable
      data={loads}
      keyExtractor={(load) => load.id}
      defaultSort={{ columnId: "pickup", direction: "desc" }}
      emptyMessage="No loads found."
      paginated={false}
      columns={[
        {
          id: "load",
          label: "Load",
          sortValue: (load) => load.loadNumber,
          render: (load) => (
            <>
              <Link href={`/loads/${load.id}`} className="font-semibold text-primary">
                {load.loadNumber}
              </Link>
              <p className="muted">{load.equipmentType}</p>
            </>
          )
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
          id: "status",
          label: "Status",
          sortValue: (load) => load.status,
          render: (load) => <StatusBadge value={load.status} />
        },
        {
          id: "margin",
          label: "Margin",
          sortValue: (load) => load.revenueCents - load.carrierCostCents,
          render: (load) => (
            <>
              <span className="font-semibold">
                {formatMoney(load.revenueCents - load.carrierCostCents)}
              </span>
              <p className="muted">{marginPercent(load.revenueCents, load.carrierCostCents)}</p>
            </>
          )
        }
      ]}
    />
  );
}
