"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { SortableTable, type SortableColumn } from "@/components/sortable-table";
import { StatusBadge } from "@/components/status-badge";
import {
  buildCustomerBoardQueryString,
  countCustomerRowsByStage,
  customerBoardColumnOptions,
  dispatchBoardStageLabels,
  dispatchBoardStages,
  filterCustomerRowsByStage,
  type CustomerBoardColumnId,
  type CustomerBoardRow,
  type DispatchBoardStageFilter
} from "@/lib/customer-board";
import { formatDate, formatDateTime, humanize } from "@/lib/format";

const boardStageTones: Record<string, string> = {
  pending: "bg-slate-100 text-slate-700",
  active: "bg-indigo-100 text-indigo-700",
  en_route: "bg-amber-100 text-amber-800",
  completed: "bg-emerald-100 text-emerald-700",
  invoiced: "bg-cyan-100 text-cyan-700",
  paid: "bg-green-100 text-green-700"
};

function BoardStageBadge({ value }: { value: string }) {
  return (
    <span className={clsx("badge", boardStageTones[value] ?? "bg-slate-100 text-slate-700")}>
      {dispatchBoardStageLabels[value as keyof typeof dispatchBoardStageLabels] ?? humanize(value)}
    </span>
  );
}

type CustomerDispatchBoardProps = {
  rows: CustomerBoardRow[];
  stage: DispatchBoardStageFilter;
  basePath?: string;
};

export function CustomerDispatchBoard({
  rows,
  stage,
  basePath = "/portal/board"
}: CustomerDispatchBoardProps) {
  const router = useRouter();
  const counts = useMemo(() => countCustomerRowsByStage(rows), [rows]);
  const visibleRows = useMemo(() => filterCustomerRowsByStage(rows, stage), [rows, stage]);

  const columns = useMemo<SortableColumn<CustomerBoardRow>[]>(() => {
    const all: SortableColumn<CustomerBoardRow>[] = [
      {
        id: "load",
        label: "Load",
        sortValue: (row) => row.loadNumber,
        render: (row) => (
          <Link href={`/portal/loads/${row.id}`} className="font-semibold text-primary">
            {row.loadNumber}
          </Link>
        )
      },
      {
        id: "stage",
        label: "Stage",
        sortValue: (row) => row.boardStage,
        render: (row) => <BoardStageBadge value={row.boardStage} />
      },
      {
        id: "status",
        label: "Status",
        sortValue: (row) => row.status,
        render: (row) => <StatusBadge value={row.status} />
      },
      {
        id: "lane",
        label: "Lane",
        sortValue: (row) =>
          `${row.pickupCity}, ${row.pickupState} to ${row.deliveryCity}, ${row.deliveryState}`,
        render: (row) => (
          <>
            {row.pickupCity}, {row.pickupState} → {row.deliveryCity}, {row.deliveryState}
          </>
        )
      },
      {
        id: "pickup",
        label: "Pickup",
        sortValue: (row) => row.pickupDate,
        render: (row) => formatDate(row.pickupDate)
      },
      {
        id: "delivery",
        label: "Delivery",
        sortValue: (row) => row.deliveryDate,
        render: (row) => formatDate(row.deliveryDate)
      },
      {
        id: "equipment",
        label: "Equipment",
        sortValue: (row) => row.equipmentType,
        render: (row) => row.equipmentType
      },
      {
        id: "commodity",
        label: "Commodity",
        sortValue: (row) => row.commodity ?? "General freight",
        render: (row) => row.commodity ?? "General freight"
      },
      {
        id: "carrier",
        label: "Carrier",
        sortValue: (row) => row.carrierName,
        render: (row) => row.carrierName
      },
      {
        id: "driver",
        label: "Driver",
        sortValue: (row) => row.driverName ?? "TBD",
        render: (row) => (
          <>
            <p className="font-semibold">{row.driverName ?? "TBD"}</p>
            <p className="muted">{row.driverPhone ?? "No phone"}</p>
          </>
        )
      },
      {
        id: "truckTrailer",
        label: "Truck/Trailer",
        sortValue: (row) => `${row.truckNumber ?? ""} ${row.trailerNumber ?? ""}`,
        render: (row) => (
          <>
            {row.truckNumber ?? "Truck TBD"} / {row.trailerNumber ?? "Trailer TBD"}
          </>
        )
      },
      {
        id: "lastCheckCall",
        label: "Last Check Call",
        sortValue: (row) => row.lastCheckCallAt ?? "",
        render: (row) =>
          row.lastCheckCallAt ? (
            <>
              <p className="font-semibold">{row.lastCheckCallStatus}</p>
              <p className="muted">{row.lastCheckCallLocation}</p>
              <p className="muted">{formatDateTime(row.lastCheckCallAt)}</p>
            </>
          ) : (
            <span className="muted">—</span>
          )
      }
    ];

    const visibleIds = new Set<CustomerBoardColumnId>(
      customerBoardColumnOptions.filter((c) => c.defaultVisible).map((c) => c.id)
    );
    return all.filter((column) => visibleIds.has(column.id as CustomerBoardColumnId));
  }, []);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={clsx("btn-secondary", stage === "all" && "ring-2 ring-primary/40")}
          onClick={() => router.push(basePath)}
        >
          All ({counts.all})
        </button>
        {dispatchBoardStages.map((stageId) => (
          <button
            key={stageId}
            type="button"
            className={clsx("btn-secondary", stage === stageId && "ring-2 ring-primary/40")}
            onClick={() => router.push(`${basePath}?${buildCustomerBoardQueryString(stageId)}`)}
          >
            {dispatchBoardStageLabels[stageId]} ({counts[stageId]})
          </button>
        ))}
      </div>

      <SortableTable
        tableId="customer-portal-board"
        data={visibleRows}
        columns={columns}
        keyExtractor={(row) => row.id}
        emptyMessage="No loads in this stage."
      />
    </div>
  );
}
