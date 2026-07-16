"use client";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import type { LatLngTuple } from "leaflet";
import "leaflet/dist/leaflet.css";

export type LoadRouteMapStop = {
  sequence: number;
  label: string;
  latitude: number;
  longitude: number;
};

export type LoadRouteMapPathPoint = {
  latitude: number;
  longitude: number;
};

export type LoadRouteReportedLocation = {
  label: string;
  latitude: number;
  longitude: number;
};

type LoadRouteMapProps = {
  stops: LoadRouteMapStop[];
  path: LoadRouteMapPathPoint[];
  reportedLocation?: LoadRouteReportedLocation | null;
  compact?: boolean;
};

function createStopIcon(sequence: number) {
  return L.divIcon({
    className: "load-stop-marker",
    html: `<span class="load-stop-marker__label">${sequence}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
}

function createReportedLocationIcon() {
  return L.divIcon({
    className: "load-reported-location-marker",
    html: `<span class="load-reported-location-marker__label">R</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function applyRouteLayers(
  map: L.Map,
  overlay: L.LayerGroup,
  polyline: LatLngTuple[],
  stopPoints: Array<{ sequence: number; label: string; latLng: LatLngTuple }>,
  reportedPoint: { label: string; latLng: LatLngTuple } | null,
  center: LatLngTuple
) {
  overlay.clearLayers();

  if (polyline.length > 1) {
    L.polyline(polyline, { color: "#2b6b80", weight: 4, opacity: 0.9 }).addTo(overlay);
  }

  for (const stop of stopPoints) {
    L.marker(stop.latLng, { icon: createStopIcon(stop.sequence) })
      .bindPopup(
        `<div class="text-sm"><p class="font-semibold">${escapeHtml(stop.label)}</p></div>`
      )
      .addTo(overlay);
  }

  if (reportedPoint) {
    L.marker(reportedPoint.latLng, { icon: createReportedLocationIcon() })
      .bindPopup(
        `<div class="text-sm"><p class="font-semibold">Reported</p><p>${escapeHtml(reportedPoint.label)}</p></div>`
      )
      .addTo(overlay);
  }

  const boundsPoints: LatLngTuple[] = [
    ...stopPoints.map((stop) => stop.latLng),
    ...polyline,
    ...(reportedPoint ? [reportedPoint.latLng] : [])
  ];

  if (boundsPoints.length > 0) {
    map.fitBounds(L.latLngBounds(boundsPoints), { padding: [28, 28] });
  } else {
    map.setView(center, 5);
  }

  map.invalidateSize({ animate: false });
}

export function LoadRouteMap({ stops, path, reportedLocation = null, compact = false }: LoadRouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const overlayRef = useRef<L.LayerGroup | null>(null);
  const routeRef = useRef({
    polyline: [] as LatLngTuple[],
    stopPoints: [] as Array<{ sequence: number; label: string; latLng: LatLngTuple }>,
    reportedPoint: null as { label: string; latLng: LatLngTuple } | null,
    center: [39.8283, -98.5795] as LatLngTuple
  });

  const polyline = useMemo<LatLngTuple[]>(
    () => path.map((point) => [point.latitude, point.longitude]),
    [path]
  );
  const stopPoints = useMemo(
    () =>
      stops.map((stop) => ({
        sequence: stop.sequence,
        label: stop.label,
        latLng: [stop.latitude, stop.longitude] as LatLngTuple
      })),
    [stops]
  );
  const reportedPoint = useMemo(
    () =>
      reportedLocation
        ? {
            label: reportedLocation.label,
            latLng: [reportedLocation.latitude, reportedLocation.longitude] as LatLngTuple
          }
        : null,
    [reportedLocation]
  );
  const center = useMemo<LatLngTuple>(() => {
    if (stops.length > 0) {
      return [stops[0].latitude, stops[0].longitude];
    }

    if (path.length > 0) {
      return [path[0].latitude, path[0].longitude];
    }

    return [39.8283, -98.5795];
  }, [path, stops]);

  routeRef.current = { polyline, stopPoints, reportedPoint, center };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    // Leaflet tags the node; clear leftover id after Strict Mode / HMR teardown.
    if ("_leaflet_id" in container) {
      delete (container as unknown as { _leaflet_id?: number })._leaflet_id;
    }

    const map = L.map(container, {
      center: routeRef.current.center,
      zoom: 5,
      scrollWheelZoom: true
    });
    const overlay = L.layerGroup().addTo(map);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    mapRef.current = map;
    overlayRef.current = overlay;
    applyRouteLayers(
      map,
      overlay,
      routeRef.current.polyline,
      routeRef.current.stopPoints,
      routeRef.current.reportedPoint,
      routeRef.current.center
    );

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });
    resizeObserver.observe(container);

    const frame = window.requestAnimationFrame(() => {
      map.invalidateSize({ animate: false });
    });

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const overlay = overlayRef.current;
    if (!map || !overlay) {
      return;
    }

    applyRouteLayers(map, overlay, polyline, stopPoints, reportedPoint, center);
  }, [center, polyline, reportedPoint, stopPoints]);

  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <div ref={containerRef} className={`w-full ${compact ? "h-64" : "h-80"}`} />
    </div>
  );
}
