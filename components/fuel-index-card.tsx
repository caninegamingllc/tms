"use client";

import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { ExternalLink, Fuel, TrendingDown, TrendingUp } from "lucide-react";
import clsx from "clsx";
import type { DieselPricePayload, DieselRegionKey, DieselWeeklyPoint } from "@/lib/eia-diesel";

type RangeKey = "4W" | "3M" | "6M" | "1Y";

const RANGE_WEEKS: Record<RangeKey, number> = {
  "4W": 4,
  "3M": 13,
  "6M": 26,
  "1Y": 52
};

const REGION_META: Array<{
  key: DieselRegionKey;
  label: string;
  shortLabel: string;
  color: string;
  defaultVisible: boolean;
}> = [
  { key: "us", label: "U.S.", shortLabel: "U.S.", color: "#2b6b80", defaultVisible: true },
  { key: "eastCoast", label: "East Coast", shortLabel: "East", color: "#49beff", defaultVisible: true },
  { key: "midwest", label: "Midwest", shortLabel: "Midwest", color: "#ffae1f", defaultVisible: true },
  { key: "gulfCoast", label: "Gulf Coast", shortLabel: "Gulf", color: "#13deb9", defaultVisible: false },
  { key: "westCoast", label: "West Coast", shortLabel: "West", color: "#fa896b", defaultVisible: true },
  { key: "california", label: "California", shortLabel: "CA", color: "#7c3aed", defaultVisible: false }
];

function formatPrice(value: number | null | undefined) {
  if (value == null) {
    return "—";
  }

  return `$${value.toFixed(2)}`;
}

function formatDelta(value: number | null | undefined) {
  if (value == null) {
    return null;
  }

  const absolute = Math.abs(value).toFixed(2);
  if (value === 0) {
    return { text: "$0.00 vs previous week", tone: "flat" as const };
  }

  if (value > 0) {
    return { text: `$${absolute} Up from previous week`, tone: "up" as const };
  }

  return { text: `$${absolute} Down from previous week`, tone: "down" as const };
}

function formatPeriodLabel(period: string) {
  const date = new Date(`${period}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return period;
  }

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatPublishedWeek(period: string | null) {
  if (!period) {
    return null;
  }

  const date = new Date(`${period}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return period;
  }

  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function sliceByRange(series: DieselWeeklyPoint[], range: RangeKey) {
  const weeks = RANGE_WEEKS[range];
  return series.slice(-weeks);
}

type FuelIndexCardProps = {
  data: DieselPricePayload;
};

export function FuelIndexCard({ data }: FuelIndexCardProps) {
  const [range, setRange] = useState<RangeKey>("3M");
  const [hidden, setHidden] = useState<Partial<Record<DieselRegionKey, boolean>>>(() =>
    Object.fromEntries(REGION_META.filter((region) => !region.defaultVisible).map((region) => [region.key, true]))
  );

  const chartData = useMemo(() => sliceByRange(data.series, range), [data.series, range]);
  const delta = formatDelta(data.summary.wowDelta);
  const published = formatPublishedWeek(data.summary.publishedAt);

  if (!data.configured || data.error || data.series.length === 0) {
    return (
      <div>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-lightprimary p-3 text-primary">
            <Fuel className="h-5 w-5" />
          </div>
          <p className="muted">On-Highway Diesel · $/gal</p>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          {data.error ?? "Fuel prices unavailable."}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-lightprimary p-3 text-primary">
            <Fuel className="h-5 w-5" />
          </div>
          <p className="muted">On-Highway Diesel · $/gal</p>
        </div>

        <div className="inline-flex rounded-lg border border-border bg-muted p-1">
          {(Object.keys(RANGE_WEEKS) as RangeKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setRange(key)}
              className={clsx(
                "rounded-md px-3 py-1.5 text-xs font-semibold transition",
                range === key ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-2">
        <div>
          <p className="font-display text-[1.75rem] font-semibold text-foreground tabular">
            {formatPrice(data.summary.latestUs)}
          </p>
          <p className="muted">U.S. Average</p>
        </div>
        {delta ? (
          <p
            className={clsx(
              "inline-flex items-center gap-1.5 text-sm font-semibold",
              delta.tone === "down" && "text-success",
              delta.tone === "up" && "text-error",
              delta.tone === "flat" && "text-muted-foreground"
            )}
          >
            {delta.tone === "down" ? <TrendingDown className="h-4 w-4" /> : null}
            {delta.tone === "up" ? <TrendingUp className="h-4 w-4" /> : null}
            {delta.text}
          </p>
        ) : null}
        <div className="muted">
          {published ? <p>Published week of {published}</p> : null}
          {data.summary.yearLow != null && data.summary.yearHigh != null ? (
            <p>
              52-wk high/low {formatPrice(data.summary.yearHigh)}–{formatPrice(data.summary.yearLow)}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {REGION_META.map((region) => {
          const price = data.summary.latestByRegion[region.key];
          const isHidden = Boolean(hidden[region.key]);

          return (
            <button
              key={region.key}
              type="button"
              onClick={() =>
                setHidden((current) => ({
                  ...current,
                  [region.key]: !current[region.key]
                }))
              }
              className={clsx(
                "rounded-lg border px-3 py-2 text-left transition",
                isHidden ? "border-border bg-muted opacity-60" : "border-border bg-card"
              )}
              title={isHidden ? `Show ${region.label}` : `Hide ${region.label}`}
            >
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: region.color }} />
                <span className="text-xs font-semibold text-muted-foreground">{region.shortLabel}</span>
              </div>
              <p className="mt-1 text-sm font-bold text-foreground">{formatPrice(price)}</p>
            </button>
          );
        })}
      </div>

      <div className="mt-5 h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="usDieselFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2b6b80" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#2b6b80" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#dfe5ef" vertical={false} />
            <XAxis
              dataKey="period"
              tickFormatter={formatPeriodLabel}
              tick={{ fill: "#5a6a85", fontSize: 12 }}
              axisLine={{ stroke: "#dfe5ef" }}
              tickLine={false}
              minTickGap={28}
            />
            <YAxis
              domain={["auto", "auto"]}
              tickFormatter={(value: number) => `$${value.toFixed(2)}`}
              tick={{ fill: "#5a6a85", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={56}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #dfe5ef",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)"
              }}
              labelFormatter={(label) => formatPublishedWeek(String(label)) ?? String(label)}
              formatter={(value, name) => [formatPrice(typeof value === "number" ? value : null), String(name)]}
            />
            <Legend
              wrapperStyle={{ paddingTop: 8 }}
              onClick={(payload) => {
                const region = REGION_META.find((item) => item.label === payload.value);
                if (!region) {
                  return;
                }

                setHidden((current) => ({
                  ...current,
                  [region.key]: !current[region.key]
                }));
              }}
            />
            {!hidden.us ? (
              <Area
                type="monotone"
                dataKey="us"
                name="U.S."
                stroke="transparent"
                fill="url(#usDieselFill)"
                legendType="none"
                isAnimationActive={false}
              />
            ) : null}
            {REGION_META.map((region) =>
              hidden[region.key] ? null : (
                <Line
                  key={region.key}
                  type="monotone"
                  dataKey={region.key}
                  name={region.label}
                  stroke={region.color}
                  strokeWidth={region.key === "us" ? 3 : 2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  connectNulls
                />
              )
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="muted">Data source: U.S. Energy Information Administration</p>
        <a
          href="https://www.eia.gov/petroleum/gasdiesel/"
          target="_blank"
          rel="noreferrer"
          className="btn-secondary gap-2"
        >
          More Details
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}
