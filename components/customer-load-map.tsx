"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import L from "leaflet";
import type { LatLngTuple } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { CustomerLoadMapMarker } from "@/lib/customer-load-map";
import { dispatchBoardStageLabels } from "@/lib/customer-board";
import { humanize } from "@/lib/format";

type CustomerLoadMapProps = {
  markers: CustomerLoadMapMarker[];
};

const stageColors: Record<string, string> = {
  pending: "#64748b",
  active: "#4f46e5",
  en_route: "#d97706",
  completed: "#059669",
  invoiced: "#0891b2",
  paid: "#16a34a"
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function createLoadIcon(marker: CustomerLoadMapMarker) {
  const color = stageColors[marker.boardStage] ?? "#334155";
  const ring = marker.positionSource === "check_call" ? "2px solid #fff" : "none";
  return L.divIcon({
    className: "customer-load-marker",
    html: `<span style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:999px;background:${color};border:${ring};box-shadow:0 2px 8px rgba(15,23,42,0.35);color:#fff;font-size:11px;font-weight:700;">${escapeHtml(marker.loadNumber.slice(-3))}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
}

function tileHtml(marker: CustomerLoadMapMarker) {
  const stage =
    dispatchBoardStageLabels[marker.boardStage as keyof typeof dispatchBoardStageLabels] ??
    humanize(marker.status);
  const reported = marker.lastReportedLocation
    ? `<p class="muted" style="margin:6px 0 0;font-size:12px">Reported: ${escapeHtml(marker.lastReportedLocation)}</p>`
    : "";
  return `
    <div class="customer-load-tile" style="min-width:180px">
      <p style="margin:0;font-weight:700;font-size:14px">${escapeHtml(marker.loadNumber)}</p>
      <p style="margin:4px 0 0;font-size:12px;color:#64748b">${escapeHtml(stage)}</p>
      <p style="margin:8px 0 0;font-size:13px"><strong>Origin</strong><br/>${escapeHtml(marker.originLabel)}</p>
      <p style="margin:6px 0 0;font-size:13px"><strong>Destination</strong><br/>${escapeHtml(marker.destinationLabel)}</p>
      ${reported}
      <p style="margin:10px 0 0;font-size:12px;color:#2b6b80;font-weight:600">Click for details →</p>
    </div>
  `;
}

export function CustomerLoadMap({ markers }: CustomerLoadMapProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const overlayRef = useRef<L.LayerGroup | null>(null);

  const points = useMemo(
    () =>
      markers.map((marker) => ({
        marker,
        latLng: [marker.lat, marker.lng] as LatLngTuple
      })),
    [markers]
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = L.map(containerRef.current, {
      scrollWheelZoom: true,
      zoomControl: true
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    const overlay = L.layerGroup().addTo(map);
    mapRef.current = map;
    overlayRef.current = overlay;

    return () => {
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

    overlay.clearLayers();

    for (const point of points) {
      const marker = L.marker(point.latLng, { icon: createLoadIcon(point.marker) });
      marker.bindTooltip(tileHtml(point.marker), {
        direction: "top",
        offset: [0, -12],
        opacity: 1,
        className: "customer-load-map-tooltip",
        sticky: true
      });
      marker.on("click", () => {
        router.push(`/portal/loads/${point.marker.id}`);
      });
      marker.addTo(overlay);
    }

    if (points.length > 0) {
      map.fitBounds(
        L.latLngBounds(points.map((p) => p.latLng)),
        { padding: [40, 40], maxZoom: 10 }
      );
    } else {
      map.setView([39.8283, -98.5795], 4);
    }

    map.invalidateSize({ animate: false });
  }, [points, router]);

  if (markers.length === 0) {
    return (
      <div className="flex h-[360px] items-center justify-center rounded-2xl border border-dashed border-border bg-muted px-6 text-center text-sm text-muted-foreground">
        No plottable loads yet. Pins appear at pickup, move with check calls, and snap to delivery when marked delivered.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <div ref={containerRef} className="h-[420px] w-full" />
      <p className="border-t border-border bg-muted px-4 py-2 text-xs text-muted-foreground">
        Hover a load icon for origin and destination. Click to open load details.{" "}
        <Link href="/portal/board" className="font-semibold text-primary">
          Open full board
        </Link>
      </p>
    </div>
  );
}
