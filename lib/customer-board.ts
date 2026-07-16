import {
  carrierDisplayName,
  primaryAssignment
} from "@/lib/dispatch-assignment";
import {
  dispatchBoardStageDescriptions,
  dispatchBoardStageFilterSchema,
  dispatchBoardStageLabels,
  dispatchBoardStages,
  getLoadBoardStage,
  type DispatchBoardStage,
  type DispatchBoardStageFilter
} from "@/lib/dispatch-board";

export {
  dispatchBoardStageDescriptions,
  dispatchBoardStageFilterSchema,
  dispatchBoardStageLabels,
  dispatchBoardStages,
  getLoadBoardStage,
  type DispatchBoardStage,
  type DispatchBoardStageFilter
};

export const customerBoardColumnOptions = [
  { id: "load", label: "Load", defaultVisible: true },
  { id: "stage", label: "Stage", defaultVisible: true },
  { id: "status", label: "Status", defaultVisible: true },
  { id: "lane", label: "Lane", defaultVisible: true },
  { id: "pickup", label: "Pickup", defaultVisible: true },
  { id: "delivery", label: "Delivery", defaultVisible: false },
  { id: "equipment", label: "Equipment", defaultVisible: true },
  { id: "commodity", label: "Commodity", defaultVisible: false },
  { id: "carrier", label: "Carrier", defaultVisible: true },
  { id: "driver", label: "Driver", defaultVisible: true },
  { id: "truckTrailer", label: "Truck/Trailer", defaultVisible: false },
  { id: "lastCheckCall", label: "Last Check Call", defaultVisible: true }
] as const;

export type CustomerBoardColumnId = (typeof customerBoardColumnOptions)[number]["id"];

export type CustomerBoardRow = {
  id: string;
  loadNumber: string;
  status: string;
  boardStage: DispatchBoardStage;
  pickupCity: string;
  pickupState: string;
  deliveryCity: string;
  deliveryState: string;
  pickupDate: string;
  deliveryDate: string;
  equipmentType: string;
  commodity: string | null;
  carrierName: string;
  driverName: string | null;
  driverPhone: string | null;
  truckNumber: string | null;
  trailerNumber: string | null;
  lastCheckCallStatus: string | null;
  lastCheckCallLocation: string | null;
  lastCheckCallAt: string | null;
};

type CustomerBoardLoad = {
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
  commodity: string | null;
  dispatchAssignments: Array<{
    id: string;
    sequence: number;
    driverName: string | null;
    driverPhone: string | null;
    truckNumber: string | null;
    trailerNumber: string | null;
    carrierId?: string | null;
    carrier: { name: string } | null;
    checkCalls: Array<{
      status: string;
      location: string;
      occurredAt: Date;
    }>;
  }>;
};

export function serializeCustomerBoardRow(load: CustomerBoardLoad): CustomerBoardRow | null {
  const boardStage = getLoadBoardStage(load);
  if (!boardStage) {
    return null;
  }

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
    pickupCity: load.pickupCity,
    pickupState: load.pickupState,
    deliveryCity: load.deliveryCity,
    deliveryState: load.deliveryState,
    pickupDate: load.pickupDate.toISOString(),
    deliveryDate: load.deliveryDate.toISOString(),
    equipmentType: load.equipmentType,
    commodity: load.commodity,
    carrierName: carrierDisplayName(load.dispatchAssignments),
    driverName: primary?.driverName ?? null,
    driverPhone: primary?.driverPhone ?? null,
    truckNumber: primary?.truckNumber ?? null,
    trailerNumber: primary?.trailerNumber ?? null,
    lastCheckCallStatus: latestCheckCall?.status ?? null,
    lastCheckCallLocation: latestCheckCall?.location ?? null,
    lastCheckCallAt: latestCheckCall?.occurredAt.toISOString() ?? null
  };
}

export function parseCustomerBoardParams(searchParams: Record<string, string | string[] | undefined>) {
  const stage =
    typeof searchParams.stage === "string" && searchParams.stage ? searchParams.stage : "all";

  return {
    stage: dispatchBoardStageFilterSchema.parse(stage)
  };
}

export function buildCustomerBoardQueryString(stage: DispatchBoardStageFilter) {
  if (stage === "all") {
    return "";
  }
  return `stage=${stage}`;
}

export function countCustomerRowsByStage(rows: CustomerBoardRow[]) {
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

export function filterCustomerRowsByStage(rows: CustomerBoardRow[], stage: DispatchBoardStageFilter) {
  if (stage === "all") {
    return rows;
  }
  return rows.filter((row) => row.boardStage === stage);
}

export const CUSTOMER_FACING_DOCUMENT_TYPES = [
  "BOL",
  "POD",
  "CUSTOMER_LOAD_CONFIRMATION",
  "INVOICE"
] as const;
