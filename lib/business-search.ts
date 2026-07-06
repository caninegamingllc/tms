type PhotonFeature = {
  properties?: {
    osm_id?: number | string;
    osm_type?: string;
    countrycode?: string;
    name?: string;
    housenumber?: string;
    street?: string;
    city?: string;
    county?: string;
    state?: string;
    postcode?: string;
    district?: string;
    locality?: string;
    type?: string;
  };
};

type PhotonResponse = {
  features?: PhotonFeature[];
};

export type BusinessSearchResult = {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  description: string;
};

const SEARCH_LIMIT = 8;
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; results: BusinessSearchResult[] }>();

const US_STATE_NAMES: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
  "district of columbia": "DC"
};

function normalizeQuery(query: string) {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

function toStateAbbreviation(state?: string) {
  if (!state) {
    return "";
  }

  const trimmed = state.trim();
  if (trimmed.length === 2) {
    return trimmed.toUpperCase();
  }

  return US_STATE_NAMES[trimmed.toLowerCase()] ?? trimmed;
}

function toAddress(houseNumber?: string, street?: string) {
  return [houseNumber?.trim(), street?.trim()].filter(Boolean).join(" ");
}

function toCity(properties: NonNullable<PhotonFeature["properties"]>) {
  return (
    properties.city?.trim() ||
    properties.locality?.trim() ||
    properties.district?.trim() ||
    properties.county?.trim() ||
    ""
  );
}

function toDescription(result: Omit<BusinessSearchResult, "description">) {
  const cityStateZip = [result.city, result.state].filter(Boolean).join(", ");
  return [result.address, cityStateZip, result.postalCode].filter(Boolean).join(" ").trim();
}

function scoreFeature(feature: PhotonFeature) {
  const props = feature.properties;
  if (!props?.name?.trim()) {
    return 0;
  }

  const type = (props.type ?? "").toLowerCase();
  if (type === "house" || type === "street") {
    return 1;
  }

  return 2;
}

function mapFeature(feature: PhotonFeature): BusinessSearchResult | null {
  const properties = feature.properties;
  if (!properties || properties.countrycode?.toLowerCase() !== "us") {
    return null;
  }

  const name = properties.name?.trim();
  if (!name) {
    return null;
  }

  const address = toAddress(properties.housenumber, properties.street);
  const city = toCity(properties);
  const state = toStateAbbreviation(properties.state);
  const postalCode = properties.postcode?.trim() ?? "";
  const id = `${properties.osm_type ?? "unknown"}-${String(properties.osm_id ?? name).trim()}`;
  const baseResult = { id, name, address, city, state, postalCode };

  return {
    ...baseResult,
    description: toDescription(baseResult)
  };
}

export async function searchBusinesses(query: string) {
  const normalizedQuery = normalizeQuery(query);
  if (normalizedQuery.length < 3) {
    return [];
  }

  const now = Date.now();
  const cached = cache.get(normalizedQuery);
  if (cached && cached.expiresAt > now) {
    return cached.results;
  }

  const params = new URLSearchParams({
    q: normalizedQuery,
    limit: String(SEARCH_LIMIT),
    lang: "en"
  });
  const response = await fetch(`https://photon.komoot.io/api/?${params.toString()}`, {
    headers: { Accept: "application/json" },
    cache: "no-store"
  });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as PhotonResponse;
  const ranked = (payload.features ?? [])
    .map((feature) => ({ feature, score: scoreFeature(feature) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => mapFeature(entry.feature))
    .filter((entry): entry is BusinessSearchResult => Boolean(entry));

  const deduped = new Map<string, BusinessSearchResult>();
  for (const item of ranked) {
    if (!deduped.has(item.id)) {
      deduped.set(item.id, item);
    }
  }

  const results = Array.from(deduped.values()).slice(0, SEARCH_LIMIT);
  cache.set(normalizedQuery, { results, expiresAt: now + CACHE_TTL_MS });
  return results;
}
