"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import type {
  LoadRouteMapPathPoint,
  LoadRouteMapStop,
  LoadRouteReportedLocation
} from "@/components/load-route-map";

const LoadRouteMap = dynamic(
  () => import("@/components/load-route-map").then((module) => module.LoadRouteMap),
  {
    ssr: false,
    loading: () => <div className="h-64 animate-pulse rounded-2xl bg-muted" />
  }
);

type RouteResponse = {
  totalMiles: number;
  stateMiles: Record<string, number>;
  polyline: string;
  path: LoadRouteMapPathPoint[];
  stops: LoadRouteMapStop[];
  cached: boolean;
  warnings: string[];
  error?: string;
};

type LoadRoutePanelProps = {
  loadId: string;
  reportedLocation?: LoadRouteReportedLocation | null;
};

async function requestRoute(loadId: string, refresh = false) {
  const response = await fetch(`/api/loads/${loadId}/route${refresh ? "?refresh=1" : ""}`);
  const payload = (await response.json()) as RouteResponse;

  if (!response.ok) {
    throw new Error(payload.error ?? "Route calculation is unavailable.");
  }

  return payload;
}

export function LoadRoutePanel({ loadId, reportedLocation = null }: LoadRoutePanelProps) {
  const [route, setRoute] = useState<RouteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let active = true;

    void requestRoute(loadId)
      .then((payload) => {
        if (!active) {
          return;
        }

        setRoute(payload);
        setError(null);
      })
      .catch((fetchError: unknown) => {
        if (!active) {
          return;
        }

        const message =
          fetchError instanceof Error ? fetchError.message : "Route calculation is unavailable.";
        setError(message);
        setRoute(null);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [loadId]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setError(null);

    void requestRoute(loadId, true)
      .then((payload) => {
        setRoute(payload);
      })
      .catch((fetchError: unknown) => {
        const message =
          fetchError instanceof Error ? fetchError.message : "Route calculation is unavailable.";
        setError(message);
        setRoute(null);
      })
      .finally(() => {
        setRefreshing(false);
      });
  }, [loadId]);

  const stateEntries = Object.entries(route?.stateMiles ?? []);
  const canShowMap = Boolean(route?.polyline && route.path.length > 1 && route.stops.length > 0);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="muted">Driving distance and state mileage.</p>
        <div className="flex items-center gap-3">
          {route?.totalMiles ? (
            <span className="text-xl font-bold text-foreground">{route.totalMiles.toLocaleString()} mi</span>
          ) : null}
          <button
            type="button"
            className="btn-secondary"
            onClick={handleRefresh}
            disabled={loading || refreshing}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {loading ? <div className="mt-4 h-64 animate-pulse rounded-2xl bg-muted" /> : null}

      {!loading && error ? (
        <div className="mt-4 rounded-2xl border border-border bg-muted p-4 text-sm text-slate-700">
          {error}
        </div>
      ) : null}

      {!loading && !error && route ? (
        <div className="mt-4 grid gap-4">
          {route.warnings.length > 0 ? (
            <div className="rounded-2xl border border-warning/30 bg-warning/10 p-3 text-sm text-slate-700">
              {route.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}

          {canShowMap ? (
            <LoadRouteMap
              stops={route.stops}
              path={route.path}
              reportedLocation={reportedLocation}
              compact
            />
          ) : null}

          {!canShowMap ? (
            <div className="rounded-2xl border border-border bg-muted p-4 text-sm text-slate-700">
              At least two geocodable stops are required to display the route map.
            </div>
          ) : null}

          {stateEntries.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold text-foreground">State mileage</h3>
              <div className="mt-2 grid gap-2 grid-cols-2">
                {stateEntries.map(([state, miles]) => (
                  <div key={state} className="flex items-center justify-between rounded-xl bg-muted px-3 py-2">
                    <span className="text-sm font-semibold text-foreground">{state}</span>
                    <span className="text-xs text-muted-foreground">{miles.toLocaleString()} mi</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
