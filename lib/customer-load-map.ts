import "server-only";
import { getLoadBoardStage, type DispatchBoardStage } from "@/lib/dispatch-board";
import { prisma } from "@/lib/db";
import { geocodeAddress, type LatLng } from "@/lib/google-maps";

export type CustomerLoadMapMarker = {
  id: string;
  loadNumber: string;
  status: string;
  boardStage: DispatchBoardStage;
  originLabel: string;
  destinationLabel: string;
  lat: number;
  lng: number;
  positionSource: "pickup" | "check_call" | "delivery";
  lastReportedLocation: string | null;
};

type StopLike = {
  id: string;
  type: string;
  sequence: number;
  address: string | null;
  city: string;
  state: string;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
};

type CheckCallLike = {
  id: string;
  location: string;
  occurredAt: Date;
  latitude: number | null;
  longitude: number | null;
};

const MAP_HIDDEN_STATUSES = new Set(["CANCELED", "INVOICED", "PAID"]);
const DELIVERY_PIN_STATUSES = new Set(["DELIVERED"]);

function cityStateLabel(city: string, state: string) {
  return `${city}, ${state}`;
}

function buildAddressCandidates(stop: Pick<StopLike, "address" | "city" | "state" | "postalCode">) {
  const cityStateZip = [stop.city, stop.state, stop.postalCode].filter(Boolean).join(", ");
  const candidates = [
    [stop.address, stop.city, stop.state, stop.postalCode].filter(Boolean).join(", "),
    cityStateZip,
    [stop.city, stop.state].filter(Boolean).join(", ")
  ];
  return [...new Set(candidates.map((c) => c.trim()).filter(Boolean))];
}

async function geocodeCandidates(candidates: string[]): Promise<LatLng | null> {
  try {
    for (const candidate of candidates) {
      const location = await geocodeAddress(candidate);
      if (location) {
        return location;
      }
    }
  } catch {
    return null;
  }
  return null;
}

async function ensureStopCoords(stop: StopLike): Promise<LatLng | null> {
  if (stop.latitude != null && stop.longitude != null) {
    return { latitude: stop.latitude, longitude: stop.longitude };
  }

  const location = await geocodeCandidates(buildAddressCandidates(stop));
  if (!location) {
    return null;
  }

  await prisma.loadStop
    .update({
      where: { id: stop.id },
      data: {
        latitude: location.latitude,
        longitude: location.longitude,
        geocodedAt: new Date()
      }
    })
    .catch(() => undefined);

  return location;
}

async function ensureCheckCallCoords(checkCall: CheckCallLike): Promise<LatLng | null> {
  if (checkCall.latitude != null && checkCall.longitude != null) {
    return { latitude: checkCall.latitude, longitude: checkCall.longitude };
  }

  const location = await geocodeCandidates([checkCall.location]);
  if (!location) {
    return null;
  }

  await prisma.checkCall
    .update({
      where: { id: checkCall.id },
      data: {
        latitude: location.latitude,
        longitude: location.longitude,
        geocodedAt: new Date()
      }
    })
    .catch(() => undefined);

  return location;
}

function pickPickupStop(stops: StopLike[], pickupCity: string, pickupState: string): StopLike | null {
  const pickup =
    stops.find((s) => s.type === "PICKUP") ??
    [...stops].sort((a, b) => a.sequence - b.sequence)[0] ??
    null;
  if (pickup) {
    return pickup;
  }
  return {
    id: "",
    type: "PICKUP",
    sequence: 0,
    address: null,
    city: pickupCity,
    state: pickupState,
    postalCode: null,
    latitude: null,
    longitude: null
  };
}

function pickDeliveryStop(
  stops: StopLike[],
  deliveryCity: string,
  deliveryState: string
): StopLike | null {
  const delivery =
    [...stops].reverse().find((s) => s.type === "DELIVERY" || s.type === "DROPOFF") ??
    [...stops].sort((a, b) => b.sequence - a.sequence)[0] ??
    null;
  if (delivery) {
    return delivery;
  }
  return {
    id: "",
    type: "DELIVERY",
    sequence: 99,
    address: null,
    city: deliveryCity,
    state: deliveryState,
    postalCode: null,
    latitude: null,
    longitude: null
  };
}

async function resolveStopOrCity(
  stop: StopLike | null,
  city: string,
  state: string
): Promise<LatLng | null> {
  if (stop?.id) {
    const cached = await ensureStopCoords(stop);
    if (cached) {
      return cached;
    }
  }
  return geocodeCandidates([[city, state].filter(Boolean).join(", ")]);
}

export async function resolveCustomerLoadMapMarkers(input: {
  companyId: string;
  customerId: string;
}): Promise<CustomerLoadMapMarker[]> {
  const loads = await prisma.load.findMany({
    where: {
      companyId: input.companyId,
      customerId: input.customerId,
      status: { notIn: [...MAP_HIDDEN_STATUSES] }
    },
    select: {
      id: true,
      loadNumber: true,
      status: true,
      pickupCity: true,
      pickupState: true,
      deliveryCity: true,
      deliveryState: true,
      stops: {
        orderBy: { sequence: "asc" },
        select: {
          id: true,
          type: true,
          sequence: true,
          address: true,
          city: true,
          state: true,
          postalCode: true,
          latitude: true,
          longitude: true
        }
      },
      dispatchAssignments: {
        orderBy: { sequence: "asc" },
        select: {
          checkCalls: {
            orderBy: { occurredAt: "desc" },
            select: {
              id: true,
              location: true,
              occurredAt: true,
              latitude: true,
              longitude: true
            }
          }
        }
      }
    },
    orderBy: { pickupDate: "asc" }
  });

  const markers: CustomerLoadMapMarker[] = [];

  for (const load of loads) {
    const boardStage = getLoadBoardStage({
      status: load.status,
      dispatchAssignments: load.dispatchAssignments
    });
    if (!boardStage) {
      continue;
    }

    const originLabel = cityStateLabel(load.pickupCity, load.pickupState);
    const destinationLabel = cityStateLabel(load.deliveryCity, load.deliveryState);
    const pickupStop = pickPickupStop(load.stops, load.pickupCity, load.pickupState);
    const deliveryStop = pickDeliveryStop(load.stops, load.deliveryCity, load.deliveryState);

    let coords: LatLng | null = null;
    let positionSource: CustomerLoadMapMarker["positionSource"] = "pickup";
    let lastReportedLocation: string | null = null;

    if (DELIVERY_PIN_STATUSES.has(load.status)) {
      coords = await resolveStopOrCity(deliveryStop, load.deliveryCity, load.deliveryState);
      positionSource = "delivery";
    } else {
      const latestCheckCall =
        load.dispatchAssignments
          .flatMap((row) => row.checkCalls)
          .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())[0] ?? null;
      if (latestCheckCall) {
        const checkCoords = await ensureCheckCallCoords(latestCheckCall);
        if (checkCoords) {
          coords = checkCoords;
          positionSource = "check_call";
          lastReportedLocation = latestCheckCall.location;
        }
      }
      if (!coords) {
        coords = await resolveStopOrCity(pickupStop, load.pickupCity, load.pickupState);
        positionSource = "pickup";
      }
    }

    if (!coords) {
      continue;
    }

    markers.push({
      id: load.id,
      loadNumber: load.loadNumber,
      status: load.status,
      boardStage,
      originLabel,
      destinationLabel,
      lat: coords.latitude,
      lng: coords.longitude,
      positionSource,
      lastReportedLocation
    });
  }

  return markers;
}

export async function geocodeAndStoreCheckCallLocation(checkCallId: string, location: string) {
  try {
    const coords = await geocodeAddress(location);
    if (!coords) {
      return;
    }
    await prisma.checkCall.update({
      where: { id: checkCallId },
      data: {
        latitude: coords.latitude,
        longitude: coords.longitude,
        geocodedAt: new Date()
      }
    });
  } catch {
    // Keep the check call even if geocoding fails.
  }
}

export async function ensureDeliveryStopGeocoded(loadId: string) {
  const load = await prisma.load.findUnique({
    where: { id: loadId },
    select: {
      deliveryCity: true,
      deliveryState: true,
      stops: {
        orderBy: { sequence: "asc" },
        select: {
          id: true,
          type: true,
          sequence: true,
          address: true,
          city: true,
          state: true,
          postalCode: true,
          latitude: true,
          longitude: true
        }
      }
    }
  });
  if (!load) {
    return;
  }
  const deliveryStop = pickDeliveryStop(load.stops, load.deliveryCity, load.deliveryState);
  if (deliveryStop?.id) {
    await ensureStopCoords(deliveryStop);
  }
}
