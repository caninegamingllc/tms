import { prisma } from "@/lib/db";
import { formatDotNumber, formatMcNumber, normalizeCarrierNumber } from "@/lib/carrier-numbers";

export type CarrierLookupResult = {
  id: string;
  source: "local" | "fmcsa";
  carrierId?: string;
  name: string;
  mcNumber?: string;
  dotNumber?: string;
  phone?: string;
  email?: string;
  equipmentTypes?: string;
  safetyRating?: string;
  complianceStatus?: string;
  description: string;
};

type FmcsaCarrierRecord = {
  dotNumber?: string | number;
  mcNumber?: string | number;
  legalName?: string;
  dbaName?: string;
  telephone?: string;
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

function mapFmcsaCarrier(carrier: FmcsaCarrierRecord, index: number): CarrierLookupResult | null {
  const name = carrier.legalName?.trim() || carrier.dbaName?.trim();
  const dotNumber = formatDotNumber(carrier.dotNumber);
  const mcNumber = formatMcNumber(carrier.mcNumber);

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
    phone: carrier.telephone?.trim() || undefined,
    safetyRating: carrier.safetyRating?.trim() || undefined,
    complianceStatus: mapComplianceStatus(carrier),
    description
  };
}

function fmcsaLookupNumber(type: "mc" | "dot", query: string) {
  const digits = query.replace(/\D/g, "");
  if (type === "dot") {
    return digits;
  }

  return digits;
}

function localLookupCandidates(type: "mc" | "dot", query: string) {
  const normalized = normalizeCarrierNumber(query);
  const digits = query.replace(/\D/g, "");
  const candidates = new Set<string>();

  if (normalized) {
    candidates.add(normalized);
  }

  if (digits) {
    candidates.add(digits);
    if (type === "mc") {
      candidates.add(`MC${digits}`);
    }
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

export async function searchLocalCarriers(
  companyId: string,
  type: "mc" | "dot",
  query: string
): Promise<CarrierLookupResult[]> {
  const candidates = localLookupCandidates(type, query).filter((value) => value.length >= 3);
  if (!candidates.length) {
    return [];
  }

  const field = type === "mc" ? "mcNumberNormalized" : "dotNumberNormalized";
  const carriers = await prisma.carrier.findMany({
    where: {
      companyId,
      OR: candidates.map((candidate) => ({
        [field]: { startsWith: candidate }
      }))
    },
    orderBy: { name: "asc" },
    take: SEARCH_LIMIT,
    select: {
      id: true,
      name: true,
      mcNumber: true,
      dotNumber: true,
      phone: true,
      email: true,
      equipmentTypes: true,
      safetyRating: true,
      complianceStatus: true
    }
  });

  return carriers.map((carrier) => ({
    id: `local-${carrier.id}`,
    source: "local" as const,
    carrierId: carrier.id,
    name: carrier.name,
    mcNumber: carrier.mcNumber ?? undefined,
    dotNumber: carrier.dotNumber ?? undefined,
    phone: carrier.phone ?? undefined,
    email: carrier.email ?? undefined,
    equipmentTypes: carrier.equipmentTypes ?? undefined,
    safetyRating: carrier.safetyRating ?? undefined,
    complianceStatus: carrier.complianceStatus,
    description: `${formatAuthorityDescription(carrier.mcNumber ?? undefined, carrier.dotNumber ?? undefined)} · Existing carrier in TMS`
  }));
}

async function fetchFmcsaCarriers(type: "mc" | "dot", query: string) {
  const lookupNumber = fmcsaLookupNumber(type, query);
  if (!lookupNumber || lookupNumber.length < 3) {
    return [];
  }

  const cacheKey = `${type}:${lookupNumber}`;
  const now = Date.now();
  const cached = fmcsaCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.results;
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
      return [];
    }

    throw new Error(`FMCSA lookup failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as FmcsaResponse;
  const results = extractFmcsaCarriers(payload)
    .map((carrier, index) => mapFmcsaCarrier(carrier, index))
    .filter((result): result is CarrierLookupResult => Boolean(result))
    .slice(0, SEARCH_LIMIT);

  fmcsaCache.set(cacheKey, { results, expiresAt: now + CACHE_TTL_MS });
  return results;
}

export async function lookupCarriers(
  companyId: string,
  type: "mc" | "dot",
  query: string
): Promise<{ results: CarrierLookupResult[]; fmcsaAvailable: boolean }> {
  const localResults = await searchLocalCarriers(companyId, type, query);
  if (localResults.length > 0) {
    return { results: localResults, fmcsaAvailable: isFmcsaConfigured() };
  }

  if (!isFmcsaConfigured()) {
    return { results: [], fmcsaAvailable: false };
  }

  try {
    const fmcsaResults = await fetchFmcsaCarriers(type, query);
    return { results: fmcsaResults, fmcsaAvailable: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "FMCSA lookup failed.";
    throw new Error(message);
  }
}
