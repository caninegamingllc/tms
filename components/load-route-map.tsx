"use client";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import type { LatLngExpression, LatLngTuple } from "leaflet";
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

type LoadRouteMapProps = {
  stops: LoadRouteMapStop[];
  path: LoadRouteMapPathPoint[];
};

function createStopIcon(sequence: number) {
  return L.divIcon({
    className: "load-stop-marker",
    html: `<span class="load-stop-marker__label">${sequence}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
}

function FitRouteBounds({ stops, path }: LoadRouteMapProps) {
  const map = useMap();
  const points = useMemo<LatLngTuple[]>(
    () => [
      ...stops.map((stop) => [stop.latitude, stop.longitude] as LatLngTuple),
      ...path.map((point) => [point.latitude, point.longitude] as LatLngTuple)
    ],
    [path, stops]
  );

  useEffect(() => {
    if (!points.length) {
      return;
    }

    map.fitBounds(L.latLngBounds(points), { padding: [28, 28] });
  }, [map, points]);

  return null;
}

export function LoadRouteMap({ stops, path }: LoadRouteMapProps) {
  const polyline = useMemo<LatLngExpression[]>(
    () => path.map((point) => [point.latitude, point.longitude]),
    [path]
  );
  const center = useMemo<LatLngExpression>(() => {
    if (stops.length > 0) {
      return [stops[0].latitude, stops[0].longitude];
    }

    if (path.length > 0) {
      return [path[0].latitude, path[0].longitude];
    }

    return [39.8283, -98.5795];
  }, [path, stops]);

  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <MapContainer center={center} zoom={5} scrollWheelZoom className="h-80 w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {polyline.length > 1 ? (
          <Polyline positions={polyline} pathOptions={{ color: "#5d87ff", weight: 4, opacity: 0.9 }} />
        ) : null}
        {stops.map((stop) => (
          <Marker
            key={stop.sequence}
            position={[stop.latitude, stop.longitude]}
            icon={createStopIcon(stop.sequence)}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-semibold">{stop.label}</p>
              </div>
            </Popup>
          </Marker>
        ))}
        <FitRouteBounds stops={stops} path={path} />
      </MapContainer>
    </div>
  );
}
