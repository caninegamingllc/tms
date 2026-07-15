"use client";

import Link from "next/link";
import { SortableTable } from "@/components/sortable-table";
import { formatDate, formatMoney } from "@/lib/format";

export type CarrierTableRow = {
  id: string;
  name: string;
  contact: string;
  mcNumber: string;
  dotNumber: string;
  equipmentTypes: string;
  complianceStatus: string;
  safetyRating: string;
  insuranceExpiresAt: string | null;
  coverageCount: number;
  loadCount: number;
  totalSpendCents: number;
};

export function CarriersTable({
  carriers,
  paginated = true
}: {
  carriers: CarrierTableRow[];
  paginated?: boolean;
}) {
  return (
    <SortableTable
      tableId="carriers"
      data={carriers}
      paginated={paginated}
      keyExtractor={(carrier) => carrier.id}
      getRowHref={(carrier) => `/carriers/${carrier.id}`}
      defaultSort={{ columnId: "carrier", direction: "asc" }}
      columns={[
        {
          id: "carrier",
          label: "Carrier",
          sortValue: (carrier) => carrier.name,
          render: (carrier) => (
            <>
              <Link href={`/carriers/${carrier.id}`} className="font-semibold text-primary">
                {carrier.name}
              </Link>
              <p className="muted">{carrier.contact}</p>
            </>
          )
        },
        {
          id: "authority",
          label: "Authority",
          sortValue: (carrier) => carrier.mcNumber,
          render: (carrier) => (
            <>
              <p>{carrier.mcNumber}</p>
              <p className="muted">{carrier.dotNumber}</p>
            </>
          )
        },
        {
          id: "equipment",
          label: "Equipment",
          sortValue: (carrier) => carrier.equipmentTypes,
          render: (carrier) => carrier.equipmentTypes
        },
        {
          id: "compliance",
          label: "Compliance",
          sortValue: (carrier) => carrier.complianceStatus,
          render: (carrier) => (
            <>
              <p className="font-semibold">{carrier.complianceStatus}</p>
              <p className="muted">{carrier.safetyRating}</p>
            </>
          )
        },
        {
          id: "insurance",
          label: "Insurance",
          sortValue: (carrier) => carrier.insuranceExpiresAt ?? "",
          render: (carrier) => (
            <>
              <p>{carrier.insuranceExpiresAt ? formatDate(carrier.insuranceExpiresAt) : "—"}</p>
              <p className="muted">{carrier.coverageCount} coverages</p>
            </>
          )
        },
        {
          id: "history",
          label: "Load History",
          sortValue: (carrier) => carrier.loadCount,
          render: (carrier) => (
            <>
              <p>{carrier.loadCount} loads</p>
              <p className="muted">{formatMoney(carrier.totalSpendCents)} spend</p>
            </>
          )
        }
      ]}
    />
  );
}
