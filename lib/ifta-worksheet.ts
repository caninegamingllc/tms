/** Contiguous US + DC IFTA jurisdictions (abbreviation). */
export const IFTA_JURISDICTIONS = [
  "AL", "AR", "AZ", "CA", "CO", "CT", "DC", "DE", "FL", "GA",
  "IA", "ID", "IL", "IN", "KS", "KY", "LA", "MA", "MD", "ME",
  "MI", "MN", "MO", "MS", "MT", "NC", "ND", "NE", "NH", "NJ",
  "NM", "NV", "NY", "OH", "OK", "OR", "PA", "RI", "SC", "SD",
  "TN", "TX", "UT", "VA", "VT", "WA", "WI", "WV", "WY"
] as const;

/**
 * Approximate IFTA diesel tax rates in cents per gallon (illustrative Phase 2 defaults).
 * Replace with current jurisdiction rates before filing.
 */
export const IFTA_DIESEL_RATE_CENTS: Record<string, number> = {
  AL: 29, AR: 28.8, AZ: 26, CA: 51.1, CO: 27.75, CT: 49.2, DC: 23.5, DE: 22,
  FL: 35.2, GA: 32.9, IA: 32.5, ID: 32, IL: 45.4, IN: 54, KS: 26, KY: 26.3,
  LA: 20, MA: 24, MD: 42.7, ME: 31.2, MI: 31.3, MN: 28.5, MO: 17, MS: 18,
  MT: 29.55, NC: 40.1, ND: 23, NE: 29.6, NH: 22.2, NJ: 50.7, NM: 22.875,
  NV: 27, NY: 40.75, OH: 47, OK: 19, OR: 40, PA: 74.1, RI: 35, SC: 28,
  SD: 28, TN: 27, TX: 20, UT: 36.5, VA: 29.8, VT: 33, WA: 49.4, WI: 32.9,
  WV: 35.7, WY: 24
};

export type IftaJurisdictionRow = {
  jurisdiction: string;
  totalMiles: number;
  taxableGallons: number;
  taxPaidGallons: number;
  netTaxableGallons: number;
  rateCents: number;
  taxDueCents: number;
};

export function buildIftaWorksheet(input: {
  trips: Array<{ jurisdiction: string; miles: number }>;
  fuels: Array<{ jurisdiction: string; gallons: number }>;
  mpgOverride?: number;
}): {
  totalMiles: number;
  totalGallons: number;
  fleetMpg: number;
  rows: IftaJurisdictionRow[];
  taxDueCents: number;
} {
  const milesBy = new Map<string, number>();
  const gallonsBy = new Map<string, number>();

  for (const trip of input.trips) {
    const j = trip.jurisdiction.toUpperCase().trim();
    if (!j || !Number.isFinite(trip.miles)) continue;
    milesBy.set(j, (milesBy.get(j) ?? 0) + Math.max(0, trip.miles));
  }
  for (const fuel of input.fuels) {
    const j = fuel.jurisdiction.toUpperCase().trim();
    if (!j || !Number.isFinite(fuel.gallons)) continue;
    gallonsBy.set(j, (gallonsBy.get(j) ?? 0) + Math.max(0, fuel.gallons));
  }

  const jurisdictions = new Set([...milesBy.keys(), ...gallonsBy.keys()]);
  const totalMiles = [...milesBy.values()].reduce((s, n) => s + n, 0);
  const totalGallons = [...gallonsBy.values()].reduce((s, n) => s + n, 0);
  const fleetMpg =
    input.mpgOverride && input.mpgOverride > 0
      ? input.mpgOverride
      : totalGallons > 0
        ? totalMiles / totalGallons
        : 0;

  const rows: IftaJurisdictionRow[] = [...jurisdictions]
    .sort()
    .map((jurisdiction) => {
      const totalMilesJ = milesBy.get(jurisdiction) ?? 0;
      const taxPaidGallons = gallonsBy.get(jurisdiction) ?? 0;
      const taxableGallons = fleetMpg > 0 ? totalMilesJ / fleetMpg : 0;
      const netTaxableGallons = taxableGallons - taxPaidGallons;
      const rateCents = IFTA_DIESEL_RATE_CENTS[jurisdiction] ?? 0;
      const taxDueCents = Math.round(netTaxableGallons * rateCents);
      return {
        jurisdiction,
        totalMiles: round2(totalMilesJ),
        taxableGallons: round2(taxableGallons),
        taxPaidGallons: round2(taxPaidGallons),
        netTaxableGallons: round2(netTaxableGallons),
        rateCents,
        taxDueCents
      };
    });

  return {
    totalMiles: round2(totalMiles),
    totalGallons: round2(totalGallons),
    fleetMpg: round2(fleetMpg),
    rows,
    taxDueCents: rows.reduce((s, r) => s + r.taxDueCents, 0)
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function formatIftaWorksheetText(input: {
  year: number;
  quarter: number;
  companyName: string;
  worksheet: ReturnType<typeof buildIftaWorksheet>;
}) {
  const { worksheet } = input;
  const lines = [
    `IFTA QUARTERLY WORKSHEET — Q${input.quarter} ${input.year}`,
    `Company: ${input.companyName}`,
    `Total miles: ${worksheet.totalMiles}`,
    `Total gallons purchased: ${worksheet.totalGallons}`,
    `Fleet MPG: ${worksheet.fleetMpg}`,
    `Net tax due (cents): ${worksheet.taxDueCents} ($${(worksheet.taxDueCents / 100).toFixed(2)})`,
    "",
    "Juris | Miles | Taxable gal | Paid gal | Net gal | Rate¢ | Tax$"
  ];
  for (const row of worksheet.rows) {
    lines.push(
      `${row.jurisdiction.padEnd(4)} | ${row.totalMiles} | ${row.taxableGallons} | ${row.taxPaidGallons} | ${row.netTaxableGallons} | ${row.rateCents} | ${(row.taxDueCents / 100).toFixed(2)}`
    );
  }
  lines.push(
    "",
    "Rates are illustrative defaults — verify current IFTA jurisdiction rates before filing."
  );
  return lines.join("\n");
}
