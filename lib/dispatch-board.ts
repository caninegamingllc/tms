import { z } from "zod";

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
  lastCheckCallStatus: string | null;
  lastCheckCallLocation: string | null;
  lastCheckCallAt: string | null;
  nextCheckAt: string | null;
  nextCheckNotes: string | null;
};

type BoardStageInput = {
  status: string;
  dispatchAssignment: unknown | null;
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

  if (load.dispatchAssignment && ["COVERED", "DISPATCHED"].includes(load.status)) {
    return "active";
  }

  if (!load.dispatchAssignment && ["QUOTE", "AVAILABLE"].includes(load.status)) {
    return "pending";
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

  const validStages = new Set<DispatchBoardStage>(dispatchBoardStages);
  const selected = new Set(
    rawValues
      .map((value) => value.trim())
      .filter((value): value is DispatchBoardStage => validStages.has(value as DispatchBoardStage))
  );

  return {
    stages: dispatchBoardStages.filter((stage) => selected.has(stage))
  };
}

export function buildDispatchBoardQueryString(stages: DispatchBoardStage[]) {
  if (!stages.length) {
    return "";
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
  dispatchAssignment: {
    driverName: string | null;
    driverPhone: string | null;
    truckNumber: string | null;
    trailerNumber: string | null;
    rateCents: number;
    carrier: { name: string } | null;
    checkCalls: Array<{
      status: string;
      location: string;
      occurredAt: Date;
      nextCheckAt: Date | null;
      nextCheckNotes: string | null;
    }>;
  } | null;
};

export function serializeDispatchBoardRow(load: DispatchBoardLoad): DispatchBoardRow | null {
  const boardStage = getLoadBoardStage(load);
  if (!boardStage) {
    return null;
  }

  const latestCheckCall = load.dispatchAssignment?.checkCalls[0] ?? null;

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
    carrierName: load.dispatchAssignment?.carrier?.name ?? "Uncovered",
    driverName: load.dispatchAssignment?.driverName ?? null,
    driverPhone: load.dispatchAssignment?.driverPhone ?? null,
    truckNumber: load.dispatchAssignment?.truckNumber ?? null,
    trailerNumber: load.dispatchAssignment?.trailerNumber ?? null,
    rateCents: load.dispatchAssignment?.rateCents ?? 0,
    revenueCents: load.revenueCents,
    carrierCostCents: load.carrierCostCents,
    lastCheckCallStatus: latestCheckCall?.status ?? null,
    lastCheckCallLocation: latestCheckCall?.location ?? null,
    lastCheckCallAt: latestCheckCall?.occurredAt.toISOString() ?? null,
    nextCheckAt: latestCheckCall?.nextCheckAt?.toISOString() ?? null,
    nextCheckNotes: latestCheckCall?.nextCheckNotes ?? null
  };
}
