import { z } from "zod";
import {
  carrierDisplayName,
  primaryAssignment,
  sumAssignmentRateCents
} from "@/lib/dispatch-assignment";

export const dispatchBoardStages = [
  "pending",
  "active",
  "en_route",
  "completed",
  "invoiced",
  "paid"
] as const;

export type DispatchBoardStage = (typeof dispatchBoardStages)[number];
export type DispatchBoardStageFilter = DispatchBoardStage | "all";

/** Stages selected when visiting /dispatch with no stage query param. */
export const defaultDispatchBoardStages: DispatchBoardStage[] = ["pending", "active", "en_route"];

export const dispatchBoardStageLabels: Record<DispatchBoardStage, string> = {
  pending: "Pending",
  active: "Active",
  en_route: "En Route",
  completed: "Completed",
  invoiced: "Invoiced",
  paid: "Paid"
};

export const dispatchBoardStageDescriptions: Record<DispatchBoardStage, string> = {
  pending: "Entered load but not booked with a carrier",
  active: "Booked with a carrier",
  en_route: "Load is picked up",
  completed: "Delivered and ready to invoice",
  invoiced: "Invoice has been sent",
  paid: "Payment has been received"
};

export const dispatchBoardStageFilterSchema = z.enum([
  "all",
  ...dispatchBoardStages
]);

export const DISPATCH_BOARD_COLUMNS_STORAGE_KEY = "tms-dispatch-board-columns";

export const dispatchBoardColumnOptions = [
  { id: "load", label: "Load", defaultVisible: true },
  { id: "stage", label: "Stage", defaultVisible: true },
  { id: "status", label: "Status", defaultVisible: true },
  { id: "customer", label: "Customer", defaultVisible: true },
  { id: "lane", label: "Lane", defaultVisible: true },
  { id: "pickup", label: "Pickup", defaultVisible: true },
  { id: "delivery", label: "Delivery", defaultVisible: false },
  { id: "equipment", label: "Equipment", defaultVisible: true },
  { id: "reeferTemp", label: "Reefer Temp", defaultVisible: true },
  { id: "commodity", label: "Commodity", defaultVisible: false },
  { id: "carrier", label: "Carrier", defaultVisible: true },
  { id: "driver", label: "Driver", defaultVisible: true },
  { id: "truckTrailer", label: "Truck/Trailer", defaultVisible: false },
  { id: "carrierRate", label: "Carrier Rate", defaultVisible: true },
  { id: "financials", label: "Revenue / Margin", defaultVisible: false },
  { id: "lastCheckCall", label: "Last Check Call", defaultVisible: true },
  { id: "nextCheck", label: "Next Check Call", defaultVisible: true }
] as const;

export type DispatchBoardColumnId = (typeof dispatchBoardColumnOptions)[number]["id"];

export type DispatchBoardRow = {
  id: string;
  loadNumber: string;
  status: string;
  boardStage: DispatchBoardStage;
  customerName: string;
  pickupCity: string;
  pickupState: string;
  deliveryCity: string;
  deliveryState: string;
  pickupDate: string;
  deliveryDate: string;
  equipmentType: string;
  reeferTempF: number | null;
  commodity: string | null;
  carrierName: string;
  driverName: string | null;
  driverPhone: string | null;
  truckNumber: string | null;
  trailerNumber: string | null;
  rateCents: number;
  revenueCents: number;
  carrierCostCents: number;
  lastCheckCallNote: string | null;
  lastCheckCallLocation: string | null;
  lastCheckCallAt: string | null;
  nextCheckAt: string | null;
  nextCheckNotes: string | null;
};

type BoardStageInput = {
  status: string;
  dispatchAssignments: unknown[] | null | undefined;
};

export function getLoadBoardStage(load: BoardStageInput): DispatchBoardStage | null {
  if (load.status === "PAID") {
    return "paid";
  }

  if (load.status === "INVOICED") {
    return "invoiced";
  }

  if (load.status === "DELIVERED") {
    return "completed";
  }

  if (load.status === "PICKED_UP") {
    return "en_route";
  }

  const hasAssignment = Boolean(load.dispatchAssignments?.length);

  // Status wins over assignment presence so loads are never silently dropped when
  // status and assignments are out of sync (e.g. DISPATCHED with no carrier yet).
  if (["COVERED", "DISPATCHED"].includes(load.status)) {
    return "active";
  }

  if (load.status === "PENDING") {
    return hasAssignment ? "active" : "pending";
  }

  if (["QUOTE", "AVAILABLE"].includes(load.status)) {
    return hasAssignment ? "active" : "pending";
  }

  return null;
}

export function parseDispatchBoardParams(searchParams: Record<string, string | string[] | undefined>) {
  const raw = searchParams.stage;
  const rawValues: string[] = [];

  if (typeof raw === "string") {
    rawValues.push(...raw.split(","));
  } else if (Array.isArray(raw)) {
    for (const value of raw) {
      rawValues.push(...value.split(","));
    }
  }

  const trimmed = rawValues.map((value) => value.trim()).filter(Boolean);

  if (!trimmed.length) {
    return { stages: [...defaultDispatchBoardStages] };
  }

  if (trimmed.includes("all")) {
    return { stages: [] };
  }

  const validStages = new Set<DispatchBoardStage>(dispatchBoardStages);
  const selected = new Set(
    trimmed.filter((value): value is DispatchBoardStage => validStages.has(value as DispatchBoardStage))
  );

  const stages = dispatchBoardStages.filter((stage) => selected.has(stage));

  return {
    stages: stages.length ? stages : [...defaultDispatchBoardStages]
  };
}

export function buildDispatchBoardQueryString(stages: DispatchBoardStage[]) {
  if (!stages.length) {
    return "stage=all";
  }

  const ordered = dispatchBoardStages.filter((stage) => stages.includes(stage));

  return `stage=${ordered.join(",")}`;
}

export function getDefaultVisibleColumnIds(): DispatchBoardColumnId[] {
  return dispatchBoardColumnOptions.filter((column) => column.defaultVisible).map((column) => column.id);
}

export function mergeVisibleColumnIds(stored: unknown): DispatchBoardColumnId[] {
  const validIds = new Set(dispatchBoardColumnOptions.map((column) => column.id));

  if (!Array.isArray(stored)) {
    return getDefaultVisibleColumnIds();
  }

  const filtered = stored.filter((value): value is DispatchBoardColumnId => {
    return typeof value === "string" && validIds.has(value as DispatchBoardColumnId);
  });

  return filtered.length ? filtered : getDefaultVisibleColumnIds();
}

export function countRowsByStage(rows: DispatchBoardRow[]) {
  const counts: Record<DispatchBoardStageFilter, number> = {
    all: rows.length,
    pending: 0,
    active: 0,
    en_route: 0,
    completed: 0,
    invoiced: 0,
    paid: 0
  };

  for (const row of rows) {
    counts[row.boardStage] += 1;
  }

  return counts;
}

export function filterRowsByStage(rows: DispatchBoardRow[], stages: DispatchBoardStage[]) {
  if (!stages.length) {
    return rows;
  }

  const selected = new Set(stages);

  return rows.filter((row) => selected.has(row.boardStage));
}

type DispatchBoardLoad = {
  id: string;
  loadNumber: string;
  status: string;
  pickupCity: string;
  pickupState: string;
  deliveryCity: string;
  deliveryState: string;
  pickupDate: Date;
  deliveryDate: Date;
  equipmentType: string;
  reeferTempF: number | null;
  commodity: string | null;
  revenueCents: number;
  carrierCostCents: number;
  customer: { name: string };
  dispatchAssignments: Array<{
    id: string;
    sequence: number;
    driverName: string | null;
    driverPhone: string | null;
    truckNumber: string | null;
    trailerNumber: string | null;
    rateCents: number;
    carrierId?: string | null;
    carrier: { name: string } | null;
    checkCalls: Array<{
      notes: string | null;
      location: string;
      occurredAt: Date;
      nextCheckAt: Date | null;
      nextCheckNotes: string | null;
    }>;
  }>;
};

export function serializeDispatchBoardRow(load: DispatchBoardLoad): DispatchBoardRow | null {
  const boardStage = getLoadBoardStage(load);
  if (!boardStage) {
    // #region agent log
    fetch("http://127.0.0.1:7361/ingest/81bab758-445f-494f-88d7-9f894e8b488d", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "9ca083" },
      body: JSON.stringify({
        sessionId: "9ca083",
        runId: "post-fix",
        hypothesisId: "A",
        location: "lib/dispatch-board.ts:serializeDispatchBoardRow",
        message: "Dropped load from dispatch board (null stage)",
        data: {
          loadNumber: load.loadNumber,
          status: load.status,
          assignmentCount: load.dispatchAssignments?.length ?? 0
        },
        timestamp: Date.now()
      })
    }).catch(() => {});
    // #endregion
    return null;
  }

  // #region agent log
  if (load.loadNumber === "2492" || load.loadNumber?.includes("2492")) {
    fetch("http://127.0.0.1:7361/ingest/81bab758-445f-494f-88d7-9f894e8b488d", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "9ca083" },
      body: JSON.stringify({
        sessionId: "9ca083",
        runId: "post-fix",
        hypothesisId: "A",
        location: "lib/dispatch-board.ts:serializeDispatchBoardRow",
        message: "Load 2492 serialized onto board",
        data: {
          loadNumber: load.loadNumber,
          status: load.status,
          boardStage,
          assignmentCount: load.dispatchAssignments?.length ?? 0
        },
        timestamp: Date.now()
      })
    }).catch(() => {});
  }
  // #endregion

  const primary = primaryAssignment(load.dispatchAssignments);
  const latestCheckCall =
    load.dispatchAssignments
      .flatMap((row) => row.checkCalls)
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())[0] ?? null;

  return {
    id: load.id,
    loadNumber: load.loadNumber,
    status: load.status,
    boardStage,
    customerName: load.customer.name,
    pickupCity: load.pickupCity,
    pickupState: load.pickupState,
    deliveryCity: load.deliveryCity,
    deliveryState: load.deliveryState,
    pickupDate: load.pickupDate.toISOString(),
    deliveryDate: load.deliveryDate.toISOString(),
    equipmentType: load.equipmentType,
    reeferTempF: load.reeferTempF,
    commodity: load.commodity,
    carrierName: carrierDisplayName(load.dispatchAssignments),
    driverName: primary?.driverName ?? null,
    driverPhone: primary?.driverPhone ?? null,
    truckNumber: primary?.truckNumber ?? null,
    trailerNumber: primary?.trailerNumber ?? null,
    rateCents: sumAssignmentRateCents(load.dispatchAssignments),
    revenueCents: load.revenueCents,
    carrierCostCents: load.carrierCostCents,
    lastCheckCallNote: latestCheckCall?.notes ?? null,
    lastCheckCallLocation: latestCheckCall?.location ?? null,
    lastCheckCallAt: latestCheckCall?.occurredAt.toISOString() ?? null,
    nextCheckAt: latestCheckCall?.nextCheckAt?.toISOString() ?? null,
    nextCheckNotes: latestCheckCall?.nextCheckNotes ?? null
  };
}
