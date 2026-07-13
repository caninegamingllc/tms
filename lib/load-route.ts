import { readFile } from "node:fs/promises";
import path from "node:path";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { lineString, point } from "@turf/helpers";
import length from "@turf/length";
import type { Feature, FeatureCollection, Polygon, MultiPolygon } from "geojson";
import { prisma } from "@/lib/db";
import {
  computeDrivingRoute,
  decodePolyline,
  geocodeAddress,
  metersToMiles,
  type LatLng
} from "@/lib/google-maps";

export type RouteStop = {
  sequence: number;
  label: string;
  latitude: number;
  longitude: number;
};

export type LoadRouteResult = {
  totalMiles: number;
  stateMiles: Record<string, number>;
  polyline: string;
  path: Array<{ latitude: number; longitude: number }>;
  stops: RouteStop[];
  cached: boolean;
  warnings: string[];
};

type LoadStopRecord = {
  sequence: number;
  type: string;
  facilityName: string;
  address: string | null;
  city: string;
  state: string;
  postalCode: string | null;
};

type StateFeature = Feature<Polygon | MultiPolygon, { name?: string }>;

const STATE_NAME_TO_ABBR: Record<string, string> = {
  Alabama: "AL",
  Alaska: "AK",
  Arizona: "AZ",
  Arkansas: "AR",
  California: "CA",
  Colorado: "CO",
  Connecticut: "CT",
  Delaware: "DE",
  "District of Columbia": "DC",
  Florida: "FL",
  Georgia: "GA",
  Hawaii: "HI",
  Idaho: "ID",
  Illinois: "IL",
  Indiana: "IN",
  Iowa: "IA",
  Kansas: "KS",
  Kentucky: "KY",
  Louisiana: "LA",
  Maine: "ME",
  Maryland: "MD",
  Massachusetts: "MA",
  Michigan: "MI",
  Minnesota: "MN",
  Mississippi: "MS",
  Missouri: "MO",
  Montana: "MT",
  Nebraska: "NE",
  Nevada: "NV",
  "New Hampshire": "NH",
  "New Jersey": "NJ",
  "New Mexico": "NM",
  "New York": "NY",
  "North Carolina": "NC",
  "North Dakota": "ND",
  Ohio: "OH",
  Oklahoma: "OK",
  Oregon: "OR",
  Pennsylvania: "PA",
  "Rhode Island": "RI",
  "South Carolina": "SC",
  "South Dakota": "SD",
  Tennessee: "TN",
  Texas: "TX",
  Utah: "UT",
  Vermont: "VT",
  Virginia: "VA",
  Washington: "WA",
  "West Virginia": "WV",
  Wisconsin: "WI",
  Wyoming: "WY"
};

let stateBoundariesPromise: Promise<StateFeature[]> | null = null;

function buildAddressCandidates(stop: LoadStopRecord) {
  const cityStateZip = [stop.city, stop.state, stop.postalCode].filter(Boolean).join(", ");
  const candidates = [
    [stop.address, stop.city, stop.state, stop.postalCode].filter(Boolean).join(", "),
    cityStateZip,
    [stop.city, stop.state].filter(Boolean).join(", ")
  ];

  return [...new Set(candidates.map((candidate) => candidate.trim()).filter(Boolean))];
}

async function geocodeStop(stop: LoadStopRecord) {
  for (const candidate of buildAddressCandidates(stop)) {
    const location = await geocodeAddress(candidate);
    if (location) {
      return location;
    }
  }

  return null;
}

async function loadStateBoundaries() {
  if (!stateBoundariesPromise) {
    stateBoundariesPromise = readFile(
      path.join(process.cwd(), "public", "geo", "us-states-simplified.json"),
      "utf8"
    ).then((raw) => {
      const collection = JSON.parse(raw) as FeatureCollection;
      return collection.features as StateFeature[];
    });
  }

  return stateBoundariesPromise;
}

function findStateForPoint(latitude: number, longitude: number, states: StateFeature[]) {
  const probe = point([longitude, latitude]);

  for (const state of states) {
    if (!state.geometry) {
      continue;
    }

    if (booleanPointInPolygon(probe, state)) {
      const name = state.properties?.name;
      return name ? STATE_NAME_TO_ABBR[name] ?? name : "Unknown";
    }
  }

  return null;
}

function computeStateMileage(encodedPolyline: string, states: StateFeature[]) {
  const coordinates = decodePolyline(encodedPolyline);
  const stateMiles: Record<string, number> = {};

  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const start = coordinates[index];
    const end = coordinates[index + 1];
    const segment = lineString([
      [start[1], start[0]],
      [end[1], end[0]]
    ]);
    const segmentMiles = metersToMiles(length(segment, { units: "kilometers" }) * 1000);
    const midpointLat = (start[0] + end[0]) / 2;
    const midpointLng = (start[1] + end[1]) / 2;
    const state = findStateForPoint(midpointLat, midpointLng, states);

    if (!state) {
      continue;
    }

    stateMiles[state] = Math.round(((stateMiles[state] ?? 0) + segmentMiles) * 10) / 10;
  }

  return Object.fromEntries(
    Object.entries(stateMiles).sort(([left], [right]) => left.localeCompare(right))
  );
}

function toPath(encodedPolyline: string) {
  return decodePolyline(encodedPolyline).map(([latitude, longitude]) => ({
    latitude,
    longitude
  }));
}

function toRouteStop(stop: LoadStopRecord, location: LatLng): RouteStop {
  return {
    sequence: stop.sequence,
    label: `${stop.sequence}. ${stop.type} - ${stop.facilityName}`,
    latitude: location.latitude,
    longitude: location.longitude
  };
}

function fromCachedRoute(load: {
  routeTotalMiles: number | null;
  routeStateMiles: unknown;
  routePolyline: string | null;
}): Omit<LoadRouteResult, "stops" | "warnings"> | null {
  if (
    load.routeTotalMiles === null ||
    !load.routePolyline ||
    !load.routeStateMiles ||
    typeof load.routeStateMiles !== "object"
  ) {
    return null;
  }

  return {
    totalMiles: load.routeTotalMiles,
    stateMiles: load.routeStateMiles as Record<string, number>,
    polyline: load.routePolyline,
    path: toPath(load.routePolyline),
    cached: true
  };
}

async function geocodeStops(stops: LoadStopRecord[]) {
  const warnings: string[] = [];
  const geocoded: Array<{ stop: LoadStopRecord; location: LatLng }> = [];

  for (const stop of stops) {
    const location = await geocodeStop(stop);
    if (!location) {
      warnings.push(`Could not locate stop ${stop.sequence} (${stop.facilityName}).`);
      continue;
    }

    geocoded.push({ stop, location });
  }

  return { geocoded, warnings };
}

export async function getLoadRoute(loadId: string, options?: { refresh?: boolean }) {
  const load = await prisma.load.findUnique({
    where: { id: loadId },
    select: {
      id: true,
      routeTotalMiles: true,
      routeStateMiles: true,
      routePolyline: true,
      routeComputedAt: true,
      stops: {
        orderBy: { sequence: "asc" },
        select: {
          sequence: true,
          type: true,
          facilityName: true,
          address: true,
          city: true,
          state: true,
          postalCode: true
        }
      }
    }
  });

  if (!load) {
    return null;
  }

  const orderedStops = load.stops;

  if (!options?.refresh) {
    const cached = fromCachedRoute(load);
    if (cached) {
      const { geocoded, warnings } = await geocodeStops(orderedStops);
      return {
        ...cached,
        stops: geocoded.map(({ stop, location }) => toRouteStop(stop, location)),
        warnings
      };
    }
  }

  const warnings: string[] = [];
  const { geocoded, warnings: geocodeWarnings } = await geocodeStops(orderedStops);
  warnings.push(...geocodeWarnings);

  if (geocoded.length < 2) {
    return {
      totalMiles: 0,
      stateMiles: {},
      polyline: "",
      path: [],
      stops: geocoded.map(({ stop, location }) => toRouteStop(stop, location)),
      cached: false,
      warnings:
        warnings.length > 0
          ? warnings
          : ["At least two geocodable stops are required to compute a route."]
    } satisfies LoadRouteResult;
  }

  const route = await computeDrivingRoute(geocoded.map((entry) => entry.location));
  const states = await loadStateBoundaries();
  const stateMiles = computeStateMileage(route.encodedPolyline, states);

  await prisma.load.update({
    where: { id: load.id },
    data: {
      routeTotalMiles: route.totalMiles,
      routeStateMiles: stateMiles,
      routePolyline: route.encodedPolyline,
      routeComputedAt: new Date()
    }
  });

  return {
    totalMiles: route.totalMiles,
    stateMiles,
    polyline: route.encodedPolyline,
    path: toPath(route.encodedPolyline),
    stops: geocoded.map(({ stop, location }) => toRouteStop(stop, location)),
    cached: false,
    warnings
  } satisfies LoadRouteResult;
}
