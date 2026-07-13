export type DieselRegionKey =
  | "us"
  | "eastCoast"
  | "midwest"
  | "gulfCoast"
  | "westCoast"
  | "california";

export type DieselWeeklyPoint = {
  period: string;
  us: number | null;
  eastCoast: number | null;
  midwest: number | null;
  gulfCoast: number | null;
  westCoast: number | null;
  california: number | null;
};

export type DieselPriceSummary = {
  latestUs: number | null;
  wowDelta: number | null;
  publishedAt: string | null;
  yearHigh: number | null;
  yearLow: number | null;
  latestByRegion: Record<DieselRegionKey, number | null>;
};

export type DieselPricePayload = {
  configured: boolean;
  error: string | null;
  series: DieselWeeklyPoint[];
  summary: DieselPriceSummary;
};

const AREA_TO_KEY: Record<string, DieselRegionKey> = {
  NUS: "us",
  R10: "eastCoast",
  R20: "midwest",
  R30: "gulfCoast",
  R50: "westCoast",
  SCA: "california"
};

const EMPTY_LATEST: Record<DieselRegionKey, number | null> = {
  us: null,
  eastCoast: null,
  midwest: null,
  gulfCoast: null,
  westCoast: null,
  california: null
};

const EMPTY_SUMMARY: DieselPriceSummary = {
  latestUs: null,
  wowDelta: null,
  publishedAt: null,
  yearHigh: null,
  yearLow: null,
  latestByRegion: { ...EMPTY_LATEST }
};

type EiaDataRow = {
  period?: string;
  duoarea?: string;
  value?: string | number | null;
};

type EiaResponse = {
  response?: {
    data?: EiaDataRow[];
  };
};

function emptyPayload(configured: boolean, error: string | null): DieselPricePayload {
  return {
    configured,
    error,
    series: [],
    summary: EMPTY_SUMMARY
  };
}

function parsePrice(value: string | number | null | undefined): number | null {
  if (value == null || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function weeksAgoIso(weeks: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - weeks * 7);
  return date.toISOString().slice(0, 10);
}

function buildSeries(rows: EiaDataRow[]): DieselWeeklyPoint[] {
  const byPeriod = new Map<string, DieselWeeklyPoint>();

  for (const row of rows) {
    const period = row.period?.trim();
    const duoarea = row.duoarea?.trim();
    if (!period || !duoarea) {
      continue;
    }

    const key = AREA_TO_KEY[duoarea];
    if (!key) {
      continue;
    }

    const existing = byPeriod.get(period) ?? {
      period,
      us: null,
      eastCoast: null,
      midwest: null,
      gulfCoast: null,
      westCoast: null,
      california: null
    };

    existing[key] = parsePrice(row.value);
    byPeriod.set(period, existing);
  }

  return [...byPeriod.values()].sort((a, b) => a.period.localeCompare(b.period));
}

function buildSummary(series: DieselWeeklyPoint[]): DieselPriceSummary {
  if (series.length === 0) {
    return EMPTY_SUMMARY;
  }

  const latest = series[series.length - 1];
  const previous = series.length > 1 ? series[series.length - 2] : null;
  const usValues = series.map((point) => point.us).filter((value): value is number => value != null);

  return {
    latestUs: latest.us,
    wowDelta:
      latest.us != null && previous?.us != null
        ? Math.round((latest.us - previous.us) * 1000) / 1000
        : null,
    publishedAt: latest.period,
    yearHigh: usValues.length ? Math.max(...usValues) : null,
    yearLow: usValues.length ? Math.min(...usValues) : null,
    latestByRegion: {
      us: latest.us,
      eastCoast: latest.eastCoast,
      midwest: latest.midwest,
      gulfCoast: latest.gulfCoast,
      westCoast: latest.westCoast,
      california: latest.california
    }
  };
}

export function isEiaConfigured() {
  return Boolean(process.env.EIA_API_KEY?.trim());
}

export async function getDieselPrices(): Promise<DieselPricePayload> {
  const apiKey = process.env.EIA_API_KEY?.trim();
  if (!apiKey) {
    return emptyPayload(false, "Configure EIA_API_KEY to show weekly diesel prices.");
  }

  const params = new URLSearchParams();
  params.set("api_key", apiKey);
  params.set("frequency", "weekly");
  params.append("data[0]", "value");
  params.append("facets[product][]", "EPD2D");
  params.append("facets[process][]", "PTE");

  for (const area of Object.keys(AREA_TO_KEY)) {
    params.append("facets[duoarea][]", area);
  }

  params.append("sort[0][column]", "period");
  params.append("sort[0][direction]", "desc");
  params.set("start", weeksAgoIso(56));
  params.set("length", "400");

  try {
    const response = await fetch(`https://api.eia.gov/v2/petroleum/pri/gnd/data/?${params.toString()}`, {
      next: { revalidate: 86400 }
    });

    if (!response.ok) {
      return emptyPayload(true, "Fuel prices unavailable right now.");
    }

    const payload = (await response.json()) as EiaResponse;
    const series = buildSeries(payload.response?.data ?? []);

    if (series.length === 0) {
      return emptyPayload(true, "No diesel price data returned from EIA.");
    }

    return {
      configured: true,
      error: null,
      series,
      summary: buildSummary(series)
    };
  } catch {
    return emptyPayload(true, "Fuel prices unavailable right now.");
  }
}
