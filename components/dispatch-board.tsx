"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { Columns3 } from "lucide-react";
import { SortableTable, type SortableColumn } from "@/components/sortable-table";
import { StatusBadge } from "@/components/status-badge";
import {
  DISPATCH_BOARD_COLUMNS_STORAGE_KEY,
  buildDispatchBoardQueryString,
  countRowsByStage,
  dispatchBoardColumnOptions,
  dispatchBoardStageDescriptions,
  dispatchBoardStageLabels,
  dispatchBoardStages,
  filterRowsByStage,
  getDefaultVisibleColumnIds,
  mergeVisibleColumnIds,
  type DispatchBoardColumnId,
  type DispatchBoardRow,
  type DispatchBoardStage
} from "@/lib/dispatch-board";
import { formatDate, formatDateTime, formatMoney, humanize, marginPercent } from "@/lib/format";

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

function buildColumns(visibleColumnIds: Set<DispatchBoardColumnId>): SortableColumn<DispatchBoardRow>[] {
  const allColumns: SortableColumn<DispatchBoardRow>[] = [
    {
      id: "load",
      label: "Load",
      sortValue: (row) => row.loadNumber,
      render: (row) => (
        <Link href={`/loads/${row.id}`} className="font-semibold text-primary">
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
      id: "customer",
      label: "Customer",
      sortValue: (row) => row.customerName,
      render: (row) => row.customerName
    },
    {
      id: "lane",
      label: "Lane",
      sortValue: (row) =>
        `${row.pickupCity}, ${row.pickupState} to ${row.deliveryCity}, ${row.deliveryState}`,
      render: (row) => (
        <>
          {row.pickupCity}, {row.pickupState} to {row.deliveryCity}, {row.deliveryState}
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
      id: "reeferTemp",
      label: "Reefer Temp",
      sortValue: (row) => row.reeferTempF ?? Number.NEGATIVE_INFINITY,
      render: (row) =>
        row.reeferTempF != null ? `${row.reeferTempF}°F` : <span className="muted">—</span>
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
      id: "carrierRate",
      label: "Carrier Rate",
      sortValue: (row) => row.rateCents,
      render: (row) => formatMoney(row.rateCents)
    },
    {
      id: "financials",
      label: "Revenue / Margin",
      sortValue: (row) => row.revenueCents - row.carrierCostCents,
      render: (row) => (
        <>
          <p className="font-semibold">{formatMoney(row.revenueCents)}</p>
          <p className="muted">
            Margin {formatMoney(row.revenueCents - row.carrierCostCents)} (
            {marginPercent(row.revenueCents, row.carrierCostCents)})
          </p>
        </>
      )
    },
    {
      id: "lastCheckCall",
      label: "Last Check Call",
      sortValue: (row) => row.lastCheckCallAt ?? "",
      render: (row) =>
        row.lastCheckCallStatus ? (
          <>
            <p className="font-semibold">{row.lastCheckCallStatus}</p>
            <p className="muted">
              {row.lastCheckCallLocation} - {formatDateTime(row.lastCheckCallAt)}
            </p>
          </>
        ) : (
          <span className="muted">No check calls</span>
        )
    },
    {
      id: "nextCheck",
      label: "Next Check Call",
      sortValue: (row) => row.nextCheckAt ?? "",
      render: (row) =>
        row.nextCheckAt ? (
          <>
            <p className="font-semibold">{formatDateTime(row.nextCheckAt)}</p>
            {row.nextCheckNotes ? <p className="muted">{row.nextCheckNotes}</p> : null}
          </>
        ) : (
          "Not scheduled"
        )
    }
  ];

  return allColumns.filter((column) => visibleColumnIds.has(column.id as DispatchBoardColumnId));
}

function readStoredColumnIds(): DispatchBoardColumnId[] {
  if (typeof window === "undefined") {
    return getDefaultVisibleColumnIds();
  }

  try {
    const stored = localStorage.getItem(DISPATCH_BOARD_COLUMNS_STORAGE_KEY);
    if (!stored) {
      return getDefaultVisibleColumnIds();
    }

    return mergeVisibleColumnIds(JSON.parse(stored));
  } catch {
    return getDefaultVisibleColumnIds();
  }
}

function subscribeToDispatchColumns(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("dispatch-columns-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("dispatch-columns-change", callback);
  };
}

function getDispatchColumnSnapshot() {
  return JSON.stringify(readStoredColumnIds());
}

function persistDispatchColumns(columnIds: DispatchBoardColumnId[]) {
  localStorage.setItem(DISPATCH_BOARD_COLUMNS_STORAGE_KEY, JSON.stringify(columnIds));
  window.dispatchEvent(new Event("dispatch-columns-change"));
}

export function DispatchBoard({
  rows,
  activeStages
}: {
  rows: DispatchBoardRow[];
  activeStages: DispatchBoardStage[];
}) {
  const router = useRouter();
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const visibleColumnIdsJson = useSyncExternalStore(
    subscribeToDispatchColumns,
    getDispatchColumnSnapshot,
    () => JSON.stringify(getDefaultVisibleColumnIds())
  );
  const visibleColumnIds = useMemo(
    () => mergeVisibleColumnIds(JSON.parse(visibleColumnIdsJson)),
    [visibleColumnIdsJson]
  );

  const stageCounts = useMemo(() => countRowsByStage(rows), [rows]);
  const activeStageSet = useMemo(() => new Set(activeStages), [activeStages]);
  const filteredRows = useMemo(() => filterRowsByStage(rows, activeStages), [rows, activeStages]);
  const visibleColumnSet = useMemo(() => new Set(visibleColumnIds), [visibleColumnIds]);
  const columns = useMemo(() => buildColumns(visibleColumnSet), [visibleColumnSet]);

  function navigateToStages(stages: DispatchBoardStage[]) {
    const query = buildDispatchBoardQueryString(stages);
    router.push(query ? `/dispatch?${query}` : "/dispatch");
  }

  function toggleStage(stage: DispatchBoardStage) {
    const next = new Set(activeStageSet);
    if (next.has(stage)) {
      next.delete(stage);
    } else {
      next.add(stage);
    }
    navigateToStages(dispatchBoardStages.filter((value) => next.has(value)));
  }

  function toggleColumn(columnId: DispatchBoardColumnId) {
    const current = mergeVisibleColumnIds(JSON.parse(visibleColumnIdsJson));
    let next: DispatchBoardColumnId[];

    if (current.includes(columnId)) {
      if (current.length === 1) {
        return;
      }

      next = current.filter((id) => id !== columnId);
    } else {
      const expanded = [...current, columnId];
      next = dispatchBoardColumnOptions
        .map((column) => column.id)
        .filter((id) => expanded.includes(id));
    }

    persistDispatchColumns(next);
  }

  function resetColumns() {
    persistDispatchColumns(getDefaultVisibleColumnIds());
  }

  return (
    <section className="card overflow-hidden p-0">
      <div className="border-b border-border p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="section-title">Dispatch Board</h2>
            <p className="muted">
              Filter by one or more workflow stages and customize visible columns for your dispatch workflow.
            </p>
          </div>

          <div className="relative">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowColumnPicker((current) => !current)}
              aria-expanded={showColumnPicker}
            >
              <Columns3 className="mr-2 h-4 w-4" aria-hidden="true" />
              Columns
            </button>

            {showColumnPicker ? (
              <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-border bg-card p-4 shadow-card">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">Visible columns</p>
                  <button type="button" className="text-sm font-semibold text-primary" onClick={resetColumns}>
                    Reset to default
                  </button>
                </div>
                <div className="grid max-h-80 gap-2 overflow-y-auto">
                  {dispatchBoardColumnOptions.map((column) => (
                    <label key={column.id} className="flex items-center gap-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border"
                        checked={visibleColumnIds.includes(column.id)}
                        onChange={() => toggleColumn(column.id)}
                      />
                      <span>{column.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            className={clsx(
              "shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition",
              activeStages.length === 0
                ? "border-primary bg-lightprimary text-primary"
                : "border-border bg-card text-foreground hover:bg-muted"
            )}
            onClick={() => navigateToStages([])}
          >
            All
            <span className="ml-2 text-muted-foreground">{stageCounts.all}</span>
          </button>

          {dispatchBoardStages.map((stage) => {
            const isActive = activeStageSet.has(stage);
            return (
              <button
                key={stage}
                type="button"
                title={dispatchBoardStageDescriptions[stage]}
                aria-pressed={isActive}
                className={clsx(
                  "shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition",
                  isActive
                    ? "border-primary bg-lightprimary text-primary"
                    : "border-border bg-card text-foreground hover:bg-muted"
                )}
                onClick={() => toggleStage(stage)}
              >
                {dispatchBoardStageLabels[stage]}
                <span className="ml-2 text-muted-foreground">{stageCounts[stage]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="overflow-x-auto">
        <SortableTable
          tableId="dispatch-board"
          data={filteredRows}
          columns={columns}
          keyExtractor={(row) => row.id}
          defaultSort={{ columnId: "pickup", direction: "asc" }}
          emptyMessage={
            activeStages.length === 0
              ? "No loads on the dispatch board."
              : `No ${activeStages.map((stage) => dispatchBoardStageLabels[stage]).join(", ")} loads right now.`
          }
        />
      </div>
    </section>
  );
}
