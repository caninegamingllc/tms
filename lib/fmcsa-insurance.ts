/** Marker stored in coverage notes so refresh can replace Motus-synced rows only. */
export const FMCSA_INSURANCE_NOTE = "FMCSA Motus Insur (c5y8-a4uz)";
/** Legacy ActPendInsur marker — used for Motus-empty backup; deleted on refresh so old imports are replaced. */
export const FMCSA_INSURANCE_NOTE_LEGACY = "FMCSA ActPendInsur (qh9u-swkp)";

const MOTUS_INSUR_URL = "https://data.transportation.gov/resource/c5y8-a4uz.json";
const MOTUS_INSHIST_URL = "https://data.transportation.gov/resource/3uet-3z4i.json";
/** Frozen after Motus cutover (~May 2026); used only when Motus returns no filings. */
const ACTPEND_INSUR_URL = "https://data.transportation.gov/resource/qh9u-swkp.json";
const CACHE_TTL_MS = 5 * 60 * 1000;
const FETCH_LIMIT = 50;

export type FmcsaInsuranceCoverage = {
  coverageType: string;
  insurerName?: string;
  policyNumber?: string;
  limitAmount?: string;
  effectiveAt?: Date;
  expiresAt?: Date;
  status: string;
  notes: string;
  fmcsaFormCode?: string;
  fmcsaTypeDesc?: string;
};

type MotusInsurRow = {
  docket_number?: string;
  usdot_number?: string;
  ins_form_code?: string;
  ins_type_code?: string;
  ins_class_code?: string;
  insurance_company_name?: string;
  policy_no?: string;
  underl_lim_amount?: string | number;
  max_cov_amount?: string | number;
  effective_date?: string;
  trans_date?: string;
};

type MotusInsHistRow = {
  usdot_number?: string;
  docket_number?: string;
  ins_form_code?: string;
  policy_no?: string;
  filing_status_reason?: string;
  cancl_effective_date?: string;
  effective_date?: string;
  insurance_company_name?: string;
};

type ActPendInsurRow = {
  docket_number?: string;
  dot_number?: string;
  ins_form_code?: string;
  /** Display name in portal is ins_type_desc; SODA field is mod_col_1 */
  mod_col_1?: string;
  ins_type_desc?: string;
  name_company?: string;
  policy_no?: string;
  underl_lim_amount?: string | number;
  max_cov_amount?: string | number;
  effective_date?: string;
  cancl_effective_date?: string;
  trans_date?: string;
};

type CacheEntry = { expiresAt: number; coverages: FmcsaInsuranceCoverage[] };

const insuranceCache = new Map<string, CacheEntry>();

function getSocrataAppToken() {
  return process.env.SOCRATA_APP_TOKEN?.trim() || undefined;
}

/** Parse FMCSA Motus dates: YYYYMMDD, YYYY-MM-DD, or MM/DD/YYYY. */
export function parseFmcsaDate(value?: string | null): Date | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (/^\d{8}$/.test(trimmed)) {
    const year = Number(trimmed.slice(0, 4));
    const month = Number(trimmed.slice(4, 6));
    const day = Number(trimmed.slice(6, 8));
    const date = new Date(Date.UTC(year, month - 1, day));
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const month = Number(slash[1]);
    const day = Number(slash[2]);
    const year = Number(slash[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  const iso = new Date(trimmed);
  return Number.isNaN(iso.getTime()) ? undefined : iso;
}

export function mapFormCodeToCoverageType(formCode?: string, typeCode?: string): string {
  const code = (formCode ?? "").trim().toUpperCase().replace(/^BMC[- ]?/i, "");
  const type = (typeCode ?? "").trim();

  if (type === "1" || code === "91" || code === "91X" || code === "82") {
    return "AUTO_LIABILITY";
  }

  if (type === "2" || code === "34" || code === "35" || code === "83") {
    return "CARGO";
  }

  if (type === "3" || type === "4" || ["84", "85"].includes(code)) {
    return "OTHER";
  }

  return "OTHER";
}

function typeDescription(row: MotusInsurRow): string | undefined {
  const typeCode = row.ins_type_code?.trim();
  const classCode = row.ins_class_code?.trim()?.toUpperCase();
  const formCode = row.ins_form_code?.trim();

  let base: string | undefined;
  switch (typeCode) {
    case "1":
      base = "BIPD";
      break;
    case "2":
      base = "Cargo";
      break;
    case "3":
      base = "Bond";
      break;
    case "4":
      base = "Trust Fund";
      break;
    default:
      base = formCode || undefined;
  }

  if (!base) {
    return undefined;
  }

  if (typeCode === "1" && classCode === "E") {
    return `${base}/Excess`;
  }
  if (typeCode === "1" && classCode === "P") {
    return `${base}/Primary`;
  }

  return base;
}

/**
 * Motus stores coverage amounts as dollars (e.g. 750000 for BIPD).
 * Metadata still says "thousands" from the legacy dictionary — live values are dollars.
 */
function formatLimitAmount(underl?: string | number, max?: string | number): string | undefined {
  const parts: string[] = [];

  for (const value of [underl, max]) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    const numeric = typeof value === "number" ? value : Number(String(value).replace(/[,$]/g, ""));
    if (!Number.isFinite(numeric) || numeric <= 0) {
      continue;
    }

    parts.push(
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0
      }).format(numeric)
    );
  }

  if (!parts.length) {
    return undefined;
  }

  return [...new Set(parts)].join(" / ");
}

/**
 * ActPendInsur stores BIPD/cargo limits in thousands of dollars (e.g. 750 → $750,000).
 */
function formatActPendLimitAmount(underl?: string | number, max?: string | number): string | undefined {
  const parts: string[] = [];

  for (const value of [underl, max]) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    const numeric = typeof value === "number" ? value : Number(String(value).replace(/[,$]/g, ""));
    if (!Number.isFinite(numeric) || numeric <= 0) {
      continue;
    }

    parts.push(
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0
      }).format(numeric * 1000)
    );
  }

  if (!parts.length) {
    return undefined;
  }

  return [...new Set(parts)].join(" / ");
}

function coverageStatus(expiresAt?: Date): string {
  if (!expiresAt) {
    return "Current";
  }

  const now = Date.now();
  const expiresMs = expiresAt.getTime();
  if (expiresMs < now) {
    return "Expired";
  }

  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  if (expiresMs - now <= thirtyDaysMs) {
    return "Expiring Soon";
  }

  return "Current";
}

function rowDedupeKey(row: MotusInsurRow) {
  return [
    row.ins_form_code?.trim() ?? "",
    row.policy_no?.trim() ?? "",
    row.effective_date?.trim() ?? "",
    String(row.max_cov_amount ?? ""),
    row.insurance_company_name?.trim()?.toUpperCase() ?? ""
  ].join("|");
}

function mapRow(row: MotusInsurRow, cancelAt?: Date): FmcsaInsuranceCoverage {
  const formCode = row.ins_form_code?.trim() || undefined;
  const typeDesc = typeDescription(row);
  const coverageType = mapFormCodeToCoverageType(formCode, row.ins_type_code);
  const effectiveAt = parseFmcsaDate(row.effective_date);
  const noteParts = [FMCSA_INSURANCE_NOTE];
  if (typeDesc) {
    noteParts.push(typeDesc);
  } else if (formCode) {
    noteParts.push(`Form ${formCode}`);
  }

  return {
    coverageType,
    insurerName: row.insurance_company_name?.trim() || undefined,
    policyNumber: row.policy_no?.trim() || undefined,
    limitAmount: formatLimitAmount(row.underl_lim_amount, row.max_cov_amount),
    effectiveAt,
    expiresAt: cancelAt,
    status: coverageStatus(cancelAt),
    notes: noteParts.join(" · "),
    fmcsaFormCode: formCode,
    fmcsaTypeDesc: typeDesc
  };
}

function actPendTypeDescription(row: ActPendInsurRow): string | undefined {
  return row.mod_col_1?.trim() || row.ins_type_desc?.trim() || undefined;
}

function actPendDedupeKey(row: ActPendInsurRow) {
  return [
    row.ins_form_code?.trim() ?? "",
    row.policy_no?.trim() ?? "",
    row.effective_date?.trim() ?? "",
    String(row.max_cov_amount ?? ""),
    row.name_company?.trim()?.toUpperCase() ?? ""
  ].join("|");
}

function mapActPendRow(row: ActPendInsurRow): FmcsaInsuranceCoverage {
  const formCode = row.ins_form_code?.trim() || undefined;
  const typeDesc = actPendTypeDescription(row);
  const coverageType = mapFormCodeToCoverageType(formCode);
  const effectiveAt = parseFmcsaDate(row.effective_date);
  const expiresAt = parseFmcsaDate(row.cancl_effective_date);
  const noteParts = [FMCSA_INSURANCE_NOTE_LEGACY, "legacy snapshot · may be stale"];
  if (typeDesc) {
    noteParts.push(typeDesc);
  } else if (formCode) {
    noteParts.push(`Form ${formCode}`);
  }

  return {
    coverageType,
    insurerName: row.name_company?.trim() || undefined,
    policyNumber: row.policy_no?.trim() || undefined,
    limitAmount: formatActPendLimitAmount(row.underl_lim_amount, row.max_cov_amount),
    effectiveAt,
    expiresAt,
    status: coverageStatus(expiresAt),
    notes: noteParts.join(" · "),
    fmcsaFormCode: formCode,
    fmcsaTypeDesc: typeDesc
  };
}

function digitsOnly(value?: string) {
  return value?.replace(/\D/g, "") || undefined;
}

/** Motus stores unpadded USDOT strings; strip leading zeros for lookup. */
function normalizeDotForMotus(value?: string) {
  const digits = digitsOnly(value);
  if (!digits) {
    return undefined;
  }

  const stripped = digits.replace(/^0+/, "");
  return stripped || undefined;
}

async function querySocrata<T>(baseUrl: string, params: URLSearchParams): Promise<T[]> {
  const token = getSocrataAppToken();
  if (token) {
    params.set("$$app_token", token);
  }

  const url = `${baseUrl}?${params.toString()}`;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        headers: { Accept: "application/json" }
      });

      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(`FMCSA insurance lookup failed with status ${response.status}.`);
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
          continue;
        }
        throw lastError;
      }

      if (!response.ok) {
        throw new Error(`FMCSA insurance lookup failed with status ${response.status}.`);
      }

      const payload = (await response.json()) as T[];
      return Array.isArray(payload) ? payload : [];
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("FMCSA insurance lookup failed.");
      if (attempt < 2 && !lastError.message.includes("status 4")) {
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
        continue;
      }
      throw lastError;
    }
  }

  throw lastError ?? new Error("FMCSA insurance lookup failed.");
}

async function fetchInsurRowsByField(field: "usdot_number" | "docket_number", value: string) {
  const params = new URLSearchParams();
  params.set(field, value);
  params.set("$limit", String(FETCH_LIMIT));
  return querySocrata<MotusInsurRow>(MOTUS_INSUR_URL, params);
}

async function fetchInsHistRowsByField(field: "usdot_number" | "docket_number", value: string) {
  const params = new URLSearchParams();
  params.set(field, value);
  params.set("$limit", String(FETCH_LIMIT));
  return querySocrata<MotusInsHistRow>(MOTUS_INSHIST_URL, params);
}

async function fetchInsurRowsForCarrier(dot?: string, docketDigits?: string) {
  const merged: MotusInsurRow[] = [];

  if (dot) {
    const byDot = await fetchInsurRowsByField("usdot_number", dot);
    merged.push(...byDot);

    // Retry padded form only if unpadded missed (legacy rows).
    if (!byDot.length) {
      const padded = dot.padStart(8, "0");
      if (padded !== dot) {
        merged.push(...(await fetchInsurRowsByField("usdot_number", padded)));
      }
    }
  }

  if (docketDigits) {
    const withPrefix = await fetchInsurRowsByField("docket_number", `MC${docketDigits}`);
    if (withPrefix.length) {
      merged.push(...withPrefix);
    } else {
      merged.push(...(await fetchInsurRowsByField("docket_number", docketDigits)));
    }
  }

  return merged;
}

/**
 * Pending cancellations from Motus InsHist (future cancl_effective_date),
 * keyed by policy number for join onto active Motus Insur rows.
 */
async function fetchPendingCancelByPolicy(
  dot?: string,
  docketDigits?: string
): Promise<Map<string, Date>> {
  const cancels = new Map<string, Date>();
  const today = Date.now();

  let rows: MotusInsHistRow[] = [];
  try {
    if (dot) {
      rows = await fetchInsHistRowsByField("usdot_number", dot);
    }
    if (!rows.length && docketDigits) {
      rows = await fetchInsHistRowsByField("docket_number", `MC${docketDigits}`);
      if (!rows.length) {
        rows = await fetchInsHistRowsByField("docket_number", docketDigits);
      }
    }
  } catch {
    return cancels;
  }

  for (const row of rows) {
    const cancelAt = parseFmcsaDate(row.cancl_effective_date);
    const policy = row.policy_no?.trim();
    if (!cancelAt || !policy) {
      continue;
    }
    if (cancelAt.getTime() < today) {
      continue;
    }

    const existing = cancels.get(policy);
    if (!existing || cancelAt.getTime() < existing.getTime()) {
      cancels.set(policy, cancelAt);
    }
  }

  return cancels;
}

function dedupeInsurRows(rows: MotusInsurRow[]): MotusInsurRow[] {
  const seen = new Set<string>();
  const unique: MotusInsurRow[] = [];

  for (const row of rows) {
    const key = rowDedupeKey(row);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(row);
  }

  return unique;
}

function dedupeActPendRows(rows: ActPendInsurRow[]): ActPendInsurRow[] {
  const seen = new Set<string>();
  const unique: ActPendInsurRow[] = [];

  for (const row of rows) {
    const key = actPendDedupeKey(row);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(row);
  }

  return unique;
}

async function fetchActPendRowsByField(field: "dot_number" | "docket_number", value: string) {
  const params = new URLSearchParams();
  params.set(field, value);
  params.set("$limit", String(FETCH_LIMIT));
  return querySocrata<ActPendInsurRow>(ACTPEND_INSUR_URL, params);
}

/**
 * ActPendInsur typically stores zero-padded USDOT (8 digits) and MC-prefixed dockets.
 * Frozen after Motus cutover — only used when Motus returns no rows.
 */
async function fetchActPendRowsForCarrier(dot?: string, docketDigits?: string) {
  const merged: ActPendInsurRow[] = [];

  if (dot) {
    const padded = dot.padStart(8, "0");
    const byPadded = await fetchActPendRowsByField("dot_number", padded);
    merged.push(...byPadded);

    if (!byPadded.length && padded !== dot) {
      merged.push(...(await fetchActPendRowsByField("dot_number", dot)));
    }
  }

  if (docketDigits) {
    const withPrefix = await fetchActPendRowsByField("docket_number", `MC${docketDigits}`);
    if (withPrefix.length) {
      merged.push(...withPrefix);
    } else {
      merged.push(...(await fetchActPendRowsByField("docket_number", docketDigits)));
    }
  }

  return merged;
}

async function fetchMotusCoverages(dot?: string, docketDigits?: string): Promise<FmcsaInsuranceCoverage[]> {
  const rows = dedupeInsurRows(await fetchInsurRowsForCarrier(dot, docketDigits));
  if (!rows.length) {
    return [];
  }

  const pendingCancels = await fetchPendingCancelByPolicy(dot, docketDigits);
  return rows.map((row) => {
    const policy = row.policy_no?.trim();
    const cancelAt = policy ? pendingCancels.get(policy) : undefined;
    return mapRow(row, cancelAt);
  });
}

async function fetchActPendCoverages(dot?: string, docketDigits?: string): Promise<FmcsaInsuranceCoverage[]> {
  try {
    const rows = dedupeActPendRows(await fetchActPendRowsForCarrier(dot, docketDigits));
    return rows.map(mapActPendRow);
  } catch {
    // Backup source only — Motus miss + ActPend failure should still fail soft as [].
    return [];
  }
}

export function earliestInsuranceExpiry(coverages: FmcsaInsuranceCoverage[]): Date | null {
  const dates = coverages
    .map((coverage) => coverage.expiresAt)
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => a.getTime() - b.getTime());

  return dates[0] ?? null;
}

/** Short summary for lookup dropdowns, e.g. "3 federal filings · BIPD $750,000" */
export function formatInsuranceLookupHint(coverages?: FmcsaInsuranceCoverage[]): string | undefined {
  if (!coverages?.length) {
    return undefined;
  }

  const count = coverages.length;
  const bipd = coverages.find((c) => c.coverageType === "AUTO_LIABILITY");
  const limitHint = bipd?.limitAmount
    ? bipd.limitAmount.includes("/")
      ? `BIPD ${bipd.limitAmount.split("/")[0]?.trim()}`
      : `BIPD ${bipd.limitAmount}`
    : undefined;
  const earliest = earliestInsuranceExpiry(coverages);
  const expiresHint = earliest ? `cancels ${earliest.toISOString().slice(0, 10)}` : undefined;

  return [
    `${count} federal filing${count === 1 ? "" : "s"}`,
    limitHint,
    expiresHint
  ]
    .filter(Boolean)
    .join(" · ");
}

export async function fetchFmcsaInsuranceCoverages(input: {
  dotNumber?: string;
  mcNumber?: string;
}): Promise<FmcsaInsuranceCoverage[]> {
  const dot = normalizeDotForMotus(input.dotNumber);
  const docket = digitsOnly(input.mcNumber);

  if (!dot && !docket) {
    return [];
  }

  const cacheKey = dot ? `dot:${dot}` : `docket:${docket}`;
  const now = Date.now();
  const cached = insuranceCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.coverages;
  }

  let coverages = await fetchMotusCoverages(dot, docket);

  // Motus is authoritative; ActPendInsur is a frozen legacy snapshot used only on empty Motus.
  if (!coverages.length) {
    coverages = await fetchActPendCoverages(dot, docket);
  }

  // Never cache empty misses — Motus/Socrata can return transient empties/throttle,
  // and caching [] made refresh look permanently empty for 5 minutes.
  if (coverages.length > 0) {
    insuranceCache.set(cacheKey, { coverages, expiresAt: now + CACHE_TTL_MS });
    if (dot && docket) {
      insuranceCache.set(`docket:${docket}`, { coverages, expiresAt: now + CACHE_TTL_MS });
    }
  } else {
    insuranceCache.delete(cacheKey);
  }

  return coverages;
}
