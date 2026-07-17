import { prisma } from "@/lib/db";
import { formatDotNumber, formatMcNumber, normalizeCarrierNumber } from "@/lib/carrier-numbers";
import type { FmcsaInsuranceCoverage } from "@/lib/fmcsa-insurance";

export type CarrierLookupResult = {
  id: string;
  source: "local" | "fmcsa";
  carrierId?: string;
  name: string;
  mcNumber?: string;
  dotNumber?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  equipmentTypes?: string;
  safetyRating?: string;
  complianceStatus?: string;
  description: string;
  insuranceCoverages?: FmcsaInsuranceCoverage[];
  /** ISO date (YYYY-MM-DD) for form prefill */
  insuranceExpiresAt?: string;
  /** Preformatted hint for lookup dropdowns */
  insuranceHint?: string;
};

type FmcsaCarrierRecord = {
  dotNumber?: string | number;
  mcNumber?: string | number;
  docketNumber?: string | number;
  legalName?: string;
  dbaName?: string;
  telephone?: string;
  phone?: string;
  phyStreet?: string;
  phyCity?: string;
  phyState?: string;
  phyZipcode?: string;
  safetyRating?: string;
  allowedToOperate?: string;
  allowToOperate?: string;
  outOfService?: string;
};

type FmcsaResponse = {
  content?: FmcsaCarrierRecord | FmcsaCarrierRecord[] | { carrier?: FmcsaCarrierRecord; carriers?: FmcsaCarrierRecord[] };
};

const FMCSA_BASE_URL = "https://mobile.fmcsa.dot.gov/qc/services";
const SEARCH_LIMIT = 8;
const CACHE_TTL_MS = 5 * 60 * 1000;
const fmcsaCache = new Map<string, { expiresAt: number; results: CarrierLookupResult[] }>();

export function isFmcsaConfigured() {
  return Boolean(process.env.FMCSA_WEB_KEY?.trim());
}

function getFmcsaWebKey() {
  const webKey = process.env.FMCSA_WEB_KEY?.trim();
  if (!webKey) {
    throw new Error("FMCSA_WEB_KEY is not configured.");
  }

  return webKey;
}

function formatAuthorityDescription(mcNumber?: string, dotNumber?: string) {
  const parts = [mcNumber, dotNumber ? `DOT ${dotNumber}` : undefined].filter(Boolean);
  return parts.join(" · ");
}

function mapComplianceStatus(carrier: FmcsaCarrierRecord) {
  const allowed = carrier.allowedToOperate ?? carrier.allowToOperate;
  if (carrier.outOfService === "Y") {
    return "Blocked";
  }

  if (allowed === "N") {
    return "Blocked";
  }

  if (allowed === "Y") {
    return "Needs Review";
  }

  return undefined;
}

function mapFmcsaCarrier(
  carrier: FmcsaCarrierRecord,
  index: number,
  queriedMcNumber?: string
): CarrierLookupResult | null {
  const name = carrier.legalName?.trim() || carrier.dbaName?.trim();
  const dotNumber = formatDotNumber(carrier.dotNumber);
  // Docket lookups often omit mcNumber in the payload; keep the queried MC when present.
  const mcNumber =
    formatMcNumber(carrier.mcNumber ?? carrier.docketNumber) ?? formatMcNumber(queriedMcNumber);

  if (!name && !dotNumber && !mcNumber) {
    return null;
  }

  const description = formatAuthorityDescription(mcNumber, dotNumber) || "FMCSA carrier record";

  return {
    id: `fmcsa-${dotNumber ?? mcNumber ?? index}`,
    source: "fmcsa",
    name: name ?? "Unknown carrier",
    mcNumber,
    dotNumber,
    phone: carrier.telephone?.trim() || carrier.phone?.trim() || undefined,
    address: carrier.phyStreet?.trim() || undefined,
    city: carrier.phyCity?.trim() || undefined,
    state: carrier.phyState?.trim() || undefined,
    postalCode: carrier.phyZipcode?.trim() || undefined,
    safetyRating: carrier.safetyRating?.trim() || undefined,
    complianceStatus: mapComplianceStatus(carrier),
    description
  };
}

export function carrierLookupNumberCandidates(query: string) {
  const digits = query.replace(/\D/g, "");
  const withoutLeadingZeros = digits.replace(/^0+/, "");
  const candidates = new Set<string>();

  if (withoutLeadingZeros) {
    candidates.add(withoutLeadingZeros);
  }

  if (digits) {
    candidates.add(digits);
  }

  return [...candidates];
}

/** Digits-only authority key so "DOT-2418890" and "2418890" share identity. */
export function authorityDigits(value?: string | null) {
  const digits = value?.replace(/\D/g, "");
  if (!digits) {
    return undefined;
  }

  return digits.replace(/^0+/, "") || digits;
}

export function localLookupCandidates(type: "mc" | "dot", query: string) {
  const normalized = normalizeCarrierNumber(query);
  const candidates = new Set<string>();

  for (const candidate of carrierLookupNumberCandidates(query)) {
    candidates.add(candidate);
    if (type === "mc") {
      candidates.add(`MC${candidate}`);
    } else {
      candidates.add(`DOT${candidate}`);
    }
  }

  if (normalized) {
    candidates.add(normalized);
  }

  return [...candidates];
}

function unwrapFmcsaCarrier(item: unknown): FmcsaCarrierRecord | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  const record = item as Record<string, unknown>;
  if (record.carrier && typeof record.carrier === "object") {
    return record.carrier as FmcsaCarrierRecord;
  }

  return record as FmcsaCarrierRecord;
}

function extractFmcsaCarriers(payload: FmcsaResponse) {
  const content = payload.content;
  if (!content) {
    return [];
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => unwrapFmcsaCarrier(item))
      .filter((carrier): carrier is FmcsaCarrierRecord => Boolean(carrier));
  }

  const carrier = unwrapFmcsaCarrier(content);
  return carrier ? [carrier] : [];
}

const localCarrierSelect = {
  id: true,
  name: true,
  mcNumber: true,
  dotNumber: true,
  phone: true,
  email: true,
  address: true,
  city: true,
  state: true,
  postalCode: true,
  equipmentTypes: true,
  safetyRating: true,
  complianceStatus: true
} as const;

function mapLocalCarrier(carrier: {
  id: string;
  name: string;
  mcNumber: string | null;
  dotNumber: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  equipmentTypes: string | null;
  safetyRating: string | null;
  complianceStatus: string;
}): CarrierLookupResult {
  return {
    id: `local-${carrier.id}`,
    source: "local",
    carrierId: carrier.id,
    name: carrier.name,
    mcNumber: carrier.mcNumber ?? undefined,
    dotNumber: carrier.dotNumber ?? undefined,
    phone: carrier.phone ?? undefined,
    email: carrier.email ?? undefined,
    address: carrier.address ?? undefined,
    city: carrier.city ?? undefined,
    state: carrier.state ?? undefined,
    postalCode: carrier.postalCode ?? undefined,
    equipmentTypes: carrier.equipmentTypes ?? undefined,
    safetyRating: carrier.safetyRating ?? undefined,
    complianceStatus: carrier.complianceStatus,
    description: `${formatAuthorityDescription(carrier.mcNumber ?? undefined, carrier.dotNumber ?? undefined)} · Existing carrier in TMS`
  };
}

export async function searchLocalCarriers(
  companyId: string,
  type: "mc" | "dot" | "auto",
  query: string
): Promise<CarrierLookupResult[]> {
  const trimmed = query.trim();
  const fields: ("mc" | "dot")[] = type === "auto" ? ["mc", "dot"] : [type];
  const orClauses: {
    name?: { contains: string; mode: "insensitive" };
    mcNumberNormalized?: { startsWith?: string; endsWith?: string };
    dotNumberNormalized?: { startsWith?: string; endsWith?: string };
    mcNumber?: { contains: string; mode: "insensitive" };
    dotNumber?: { contains: string; mode: "insensitive" };
  }[] = [];

  if (type === "auto" && trimmed.length >= 3) {
    orClauses.push({ name: { contains: trimmed, mode: "insensitive" } });
  }

  for (const field of fields) {
    const column = field === "mc" ? "mcNumberNormalized" : "dotNumberNormalized";
    const rawColumn = field === "mc" ? "mcNumber" : "dotNumber";
    const candidates = localLookupCandidates(field, query).filter((value) => value.length >= 3);
    for (const candidate of candidates) {
      orClauses.push({ [column]: { startsWith: candidate } });
    }

    // Match "DOT2418890" / "MC784512" when the user typed digits only.
    for (const digits of carrierLookupNumberCandidates(query).filter((value) => value.length >= 3)) {
      orClauses.push({ [column]: { endsWith: digits } });
      orClauses.push({ [rawColumn]: { contains: digits, mode: "insensitive" } });
    }
  }

  if (!orClauses.length) {
    return [];
  }

  const carriers = await prisma.carrier.findMany({
    where: {
      companyId,
      OR: orClauses
    },
    orderBy: { name: "asc" },
    take: SEARCH_LIMIT,
    select: localCarrierSelect
  });

  return carriers.map(mapLocalCarrier);
}

async function fetchFmcsaCarriers(type: "mc" | "dot", query: string) {
  const lookupNumbers = carrierLookupNumberCandidates(query).filter((value) => value.length >= 3);
  if (!lookupNumbers.length) {
    return [];
  }

  for (const lookupNumber of lookupNumbers) {
    const cacheKey = `fmcsa:${type}:${lookupNumber}`;
    const now = Date.now();
    const cached = fmcsaCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      if (cached.results.length > 0) {
        return cached.results;
      }

      continue;
    }

    const webKey = getFmcsaWebKey();
    const path =
      type === "dot"
        ? `carriers/${encodeURIComponent(lookupNumber)}`
        : `carriers/docket-number/${encodeURIComponent(lookupNumber)}`;
    const url = `${FMCSA_BASE_URL}/${path}?webKey=${encodeURIComponent(webKey)}`;

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      if (response.status === 404) {
        fmcsaCache.set(cacheKey, { results: [], expiresAt: now + CACHE_TTL_MS });
        continue;
      }

      throw new Error(`FMCSA lookup failed with status ${response.status}.`);
    }

    const payload = (await response.json()) as FmcsaResponse;
    // Skip Motus/ActPend insurance enrichment here — those remote calls dominate
    // latency. Insurance is imported when the carrier is added/refreshed.
    const results = extractFmcsaCarriers(payload)
      .map((carrier, index) =>
        mapFmcsaCarrier(carrier, index, type === "mc" ? lookupNumber : undefined)
      )
      .filter((result): result is CarrierLookupResult => Boolean(result))
      .slice(0, SEARCH_LIMIT);

    fmcsaCache.set(cacheKey, { results, expiresAt: now + CACHE_TTL_MS });
    if (results.length > 0) {
      return results;
    }
  }

  return [];
}

async function fetchFmcsaForType(type: "mc" | "dot" | "auto", query: string) {
  if (type !== "auto") {
    return fetchFmcsaCarriers(type, query);
  }

  // FMCSA only supports MC/DOT number lookups. Skip federal search for name queries.
  const digits = query.replace(/\D/g, "");
  if (digits.length < 3) {
    return [];
  }

  // An MC docket of one carrier can equal the USDOT of another. Always query
  // both authorities and keep every distinct hit.
  const [mcResults, dotResults] = await Promise.all([
    fetchFmcsaCarriers("mc", query),
    fetchFmcsaCarriers("dot", query)
  ]);

  return mergeLookupResults([], [...mcResults, ...dotResults]);
}

function authorityMatchKeys(result: Pick<CarrierLookupResult, "carrierId" | "mcNumber" | "dotNumber">) {
  const keys: string[] = [];

  if (result.carrierId) {
    keys.push(`id:${result.carrierId}`);
  }

  const mcDigits = authorityDigits(result.mcNumber);
  if (mcDigits) {
    keys.push(`mc:${mcDigits}`);
  }

  const dotDigits = authorityDigits(result.dotNumber);
  if (dotDigits) {
    keys.push(`dot:${dotDigits}`);
  }

  return keys;
}

function resultsShareIdentity(a: CarrierLookupResult, b: CarrierLookupResult) {
  const aKeys = new Set(authorityMatchKeys(a));
  return authorityMatchKeys(b).some((key) => aKeys.has(key));
}

function preferLookupResult(current: CarrierLookupResult, incoming: CarrierLookupResult) {
  // Prefer the TMS record when the same entity appears from both sources.
  if (current.source !== incoming.source) {
    const preferred = current.source === "local" ? current : incoming;
    const other = preferred === current ? incoming : current;
    const mcNumber = preferred.mcNumber ?? other.mcNumber;
    const dotNumber = preferred.dotNumber ?? other.dotNumber;
    return {
      ...preferred,
      mcNumber,
      dotNumber,
      insuranceCoverages: preferred.insuranceCoverages ?? other.insuranceCoverages,
      insuranceExpiresAt: preferred.insuranceExpiresAt ?? other.insuranceExpiresAt,
      insuranceHint: preferred.insuranceHint ?? other.insuranceHint,
      phone: preferred.phone ?? other.phone,
      email: preferred.email ?? other.email,
      address: preferred.address ?? other.address,
      city: preferred.city ?? other.city,
      state: preferred.state ?? other.state,
      postalCode: preferred.postalCode ?? other.postalCode,
      safetyRating: preferred.safetyRating ?? other.safetyRating,
      complianceStatus: preferred.complianceStatus ?? other.complianceStatus,
      description:
        preferred.source === "local"
          ? `${formatAuthorityDescription(mcNumber, dotNumber)} · Existing carrier in TMS`
          : preferred.description
    };
  }

  return current;
}

/** Merge local + FMCSA hits, collapsing the same carrier identity into one row. */
export function mergeLookupResults(
  localResults: CarrierLookupResult[],
  fmcsaResults: CarrierLookupResult[]
): CarrierLookupResult[] {
  const merged: CarrierLookupResult[] = [];

  for (const result of [...localResults, ...fmcsaResults]) {
    const existingIndex = merged.findIndex((item) => resultsShareIdentity(item, result));
    if (existingIndex === -1) {
      merged.push(result);
      continue;
    }

    merged[existingIndex] = preferLookupResult(merged[existingIndex], result);
  }

  return merged.slice(0, SEARCH_LIMIT);
}

/** Find TMS carriers that match FMCSA authority numbers (even when the query itself missed). */
export async function findLocalCarriersByAuthorities(
  companyId: string,
  authorities: Array<{ mcNumber?: string; dotNumber?: string }>
): Promise<CarrierLookupResult[]> {
  const mcValues = new Set<string>();
  const dotValues = new Set<string>();

  for (const authority of authorities) {
    for (const value of localLookupCandidates("mc", authority.mcNumber ?? "")) {
      mcValues.add(value);
    }
    for (const value of localLookupCandidates("dot", authority.dotNumber ?? "")) {
      dotValues.add(value);
    }
  }

  const orClauses: (
    | { mcNumberNormalized: string }
    | { dotNumberNormalized: string }
    | { mcNumberNormalized: { endsWith: string } }
    | { dotNumberNormalized: { endsWith: string } }
    | { mcNumber: { contains: string; mode: "insensitive" } }
    | { dotNumber: { contains: string; mode: "insensitive" } }
  )[] = [
    ...[...mcValues].map((value) => ({ mcNumberNormalized: value })),
    ...[...dotValues].map((value) => ({ dotNumberNormalized: value }))
  ];

  for (const authority of authorities) {
    const mcDigits = authorityDigits(authority.mcNumber);
    if (mcDigits && mcDigits.length >= 3) {
      orClauses.push({ mcNumberNormalized: { endsWith: mcDigits } });
      orClauses.push({ mcNumber: { contains: mcDigits, mode: "insensitive" } });
    }

    const dotDigits = authorityDigits(authority.dotNumber);
    if (dotDigits && dotDigits.length >= 3) {
      orClauses.push({ dotNumberNormalized: { endsWith: dotDigits } });
      orClauses.push({ dotNumber: { contains: dotDigits, mode: "insensitive" } });
    }
  }

  if (!orClauses.length) {
    return [];
  }

  const carriers = await prisma.carrier.findMany({
    where: {
      companyId,
      OR: orClauses
    },
    orderBy: { name: "asc" },
    take: SEARCH_LIMIT,
    select: localCarrierSelect
  });

  return carriers.map(mapLocalCarrier);
}

export async function lookupCarriers(
  companyId: string,
  type: "mc" | "dot" | "auto",
  query: string
): Promise<{ results: CarrierLookupResult[]; fmcsaAvailable: boolean }> {
  const fmcsaAvailable = isFmcsaConfigured();

  let fmcsaResults: CarrierLookupResult[] = [];
  let fmcsaError: Error | null = null;

  const localPromise = searchLocalCarriers(companyId, type, query);
  const fmcsaPromise = fmcsaAvailable
    ? fetchFmcsaForType(type, query).catch((error) => {
        fmcsaError = error instanceof Error ? error : new Error("FMCSA lookup failed.");
        return [] as CarrierLookupResult[];
      })
    : Promise.resolve([] as CarrierLookupResult[]);

  const [localResults, remoteResults] = await Promise.all([localPromise, fmcsaPromise]);
  fmcsaResults = remoteResults;

  // FMCSA may return a DOT/MC the query didn't match locally (e.g. TMS has DOT
  // only; user searched MC). Pull those TMS rows so we never offer "Add" for
  // a carrier that already exists.
  const reconciledLocals =
    fmcsaResults.length > 0
      ? await findLocalCarriersByAuthorities(companyId, fmcsaResults)
      : [];

  const results = mergeLookupResults([...localResults, ...reconciledLocals], fmcsaResults);

  if (!results.length && fmcsaError) {
    throw fmcsaError;
  }

  return { results, fmcsaAvailable };
}
