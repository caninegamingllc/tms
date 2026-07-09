export type BusinessSearchResult = {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  phone: string;
  description: string;
};

type GoogleAddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};

type GoogleAutocompleteSuggestion = {
  placePrediction?: {
    placeId?: string;
    structuredFormat?: {
      mainText?: { text?: string };
      secondaryText?: { text?: string };
    };
    text?: { text?: string };
  };
};

type GoogleAutocompleteResponse = {
  suggestions?: GoogleAutocompleteSuggestion[];
};

type GooglePlaceDetailsResponse = {
  displayName?: { text?: string };
  formattedAddress?: string;
  addressComponents?: GoogleAddressComponent[];
  nationalPhoneNumber?: string;
  location?: { latitude?: number; longitude?: number };
  types?: string[];
  primaryType?: string;
};

type GoogleTextSearchPlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  addressComponents?: GoogleAddressComponent[];
  nationalPhoneNumber?: string;
};

type GoogleTextSearchResponse = {
  places?: GoogleTextSearchPlace[];
};

function buildResultDescription(parts: {
  address: string;
  city: string;
  state: string;
  postalCode: string;
  formattedAddress?: string;
  phone?: string;
}) {
  const locationLine =
    toDescription(parts) || parts.formattedAddress?.trim() || parts.address.trim();
  return [locationLine, parts.phone?.trim()].filter(Boolean).join(" · ");
}

function mapTextSearchPlace(place: GoogleTextSearchPlace): BusinessSearchResult | null {
  const id = normalizePlaceId(place.id ?? "");
  const name = place.displayName?.text?.trim() ?? "";
  if (!id || !name) {
    return null;
  }

  const parsed = parseAddressComponents(place.addressComponents ?? []);
  const phone = place.nationalPhoneNumber?.trim() ?? "";
  const address = parsed.address || place.formattedAddress?.trim() || "";
  const description = buildResultDescription({
    ...parsed,
    address,
    formattedAddress: place.formattedAddress,
    phone
  });

  return {
    id,
    name,
    address,
    city: parsed.city,
    state: parsed.state,
    postalCode: parsed.postalCode,
    phone,
    description
  };
}

export function isEnrichedPlaceResult(result: BusinessSearchResult) {
  if (!result.name || !result.city || (!result.address && !result.phone)) {
    return false;
  }

  if (looksLikeStreetAddress(result.name, result.address)) {
    return Boolean(result.phone);
  }

  return Boolean(result.phone);
}

const ADDRESS_PRIMARY_TYPES = new Set([
  "street_address",
  "route",
  "subpremise",
  "premise",
  "geocode",
  "plus_code"
]);

function looksLikeStreetAddress(name: string, address: string) {
  const normalizedName = name.trim().toLowerCase();
  const normalizedAddress = address.trim().toLowerCase();

  if (normalizedAddress && normalizedName === normalizedAddress) {
    return true;
  }

  return /^\d{1,6}\s+\S/.test(name.trim());
}

function isBusinessPlace(types: string[] = [], primaryType?: string) {
  if (primaryType && !ADDRESS_PRIMARY_TYPES.has(primaryType)) {
    return true;
  }

  return types.some(
    (type) =>
      type === "establishment" ||
      type === "point_of_interest" ||
      type === "store" ||
      type.endsWith("_store")
  );
}

function mergeBusinessWithAddress(
  business: BusinessSearchResult,
  address: BusinessSearchResult
): BusinessSearchResult {
  return {
    id: business.id || address.id,
    name: business.name || address.name,
    address: address.address || business.address,
    city: address.city || business.city,
    state: address.state || business.state,
    postalCode: address.postalCode || business.postalCode,
    phone: business.phone || address.phone,
    description: buildResultDescription({
      address: address.address || business.address,
      city: address.city || business.city,
      state: address.state || business.state,
      postalCode: address.postalCode || business.postalCode,
      formattedAddress: business.description,
      phone: business.phone || address.phone
    })
  };
}

const SEARCH_LIMIT = 8;
const CACHE_TTL_MS = 5 * 60 * 1000;
const autocompleteCache = new Map<string, { expiresAt: number; results: BusinessSearchResult[] }>();
const textSearchCache = new Map<string, { expiresAt: number; results: BusinessSearchResult[] }>();
const detailsCache = new Map<string, { expiresAt: number; result: BusinessSearchResult }>();

export function shouldUseTextSearch(query: string, field: "name" | "address") {
  const trimmed = query.trim();
  if (field === "address") {
    return true;
  }

  if (trimmed.includes(",")) {
    return true;
  }

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  return tokens.length >= 2;
}

function normalizePlaceId(placeId: string) {
  return placeId.trim().replace(/^places\//, "");
}

function getGooglePlacesApiKey() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GOOGLE_PLACES_API_KEY is not configured.");
  }

  return apiKey;
}

function normalizeQuery(query: string) {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

function toDescription(parts: { address: string; city: string; state: string; postalCode: string }) {
  const cityState = [parts.city, parts.state].filter(Boolean).join(", ");
  return [parts.address, cityState, parts.postalCode].filter(Boolean).join(" ").trim();
}

function componentValue(component: GoogleAddressComponent, preferShort = false) {
  if (preferShort && component.shortText) {
    return component.shortText;
  }

  return component.longText ?? component.shortText ?? "";
}

function parseAddressComponents(components: GoogleAddressComponent[]) {
  let streetNumber = "";
  let route = "";
  let city = "";
  let state = "";
  let postalCode = "";

  for (const component of components) {
    const types = component.types ?? [];
    if (types.includes("street_number")) {
      streetNumber = componentValue(component);
    }
    if (types.includes("route")) {
      route = componentValue(component);
    }
    if (types.includes("locality")) {
      city = componentValue(component);
    }
    if (!city && types.includes("postal_town")) {
      city = componentValue(component);
    }
    if (!city && types.includes("sublocality")) {
      city = componentValue(component);
    }
    if (!city && types.includes("administrative_area_level_2")) {
      city = componentValue(component);
    }
    if (types.includes("administrative_area_level_1")) {
      state = componentValue(component, true).toUpperCase();
    }
    if (types.includes("postal_code")) {
      postalCode = componentValue(component);
    }
  }

  return {
    address: [streetNumber, route].filter(Boolean).join(" "),
    city,
    state,
    postalCode
  };
}

function mapAutocompleteSuggestion(
  suggestion: GoogleAutocompleteSuggestion
): BusinessSearchResult | null {
  const prediction = suggestion.placePrediction;
  const placeId = prediction?.placeId?.trim();
  const name =
    prediction?.structuredFormat?.mainText?.text?.trim() ||
    prediction?.text?.text?.trim() ||
    "";

  if (!placeId || !name) {
    return null;
  }

  const description = prediction?.structuredFormat?.secondaryText?.text?.trim() ?? "";

  return {
    id: placeId,
    name,
    address: "",
    city: "",
    state: "",
    postalCode: "",
    phone: "",
    description
  };
}

type GooglePlacesError = {
  error?: {
    message?: string;
    status?: string;
  };
};

async function googlePlacesRequest<T>(
  url: string,
  init: RequestInit & { fieldMask?: string }
): Promise<T> {
  const apiKey = getGooglePlacesApiKey();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  headers.set("X-Goog-Api-Key", apiKey);
  if (init.fieldMask) {
    headers.set("X-Goog-FieldMask", init.fieldMask);
  }

  const response = await fetch(url, {
    ...init,
    headers,
    cache: "no-store"
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as GooglePlacesError | null;
    const message =
      payload?.error?.message ??
      `Google Places request failed with status ${response.status}.`;
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export async function searchPlacesByText(query: string) {
  const normalizedQuery = normalizeQuery(query);
  if (normalizedQuery.length < 3) {
    return [];
  }

  const cacheKey = `text:${normalizedQuery}`;
  const now = Date.now();
  const cached = textSearchCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.results;
  }

  const payload = await googlePlacesRequest<GoogleTextSearchResponse>(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      fieldMask:
        "places.id,places.displayName,places.formattedAddress,places.addressComponents,places.nationalPhoneNumber",
      body: JSON.stringify({
        textQuery: query.trim(),
        maxResultCount: SEARCH_LIMIT,
        regionCode: "US",
        languageCode: "en"
      })
    }
  );

  const results = (payload.places ?? [])
    .map((place) => mapTextSearchPlace(place))
    .filter((result): result is BusinessSearchResult => Boolean(result))
    .slice(0, SEARCH_LIMIT);

  textSearchCache.set(cacheKey, { results, expiresAt: now + CACHE_TTL_MS });
  return results;
}

async function searchNearbyEstablishments(latitude: number, longitude: number) {
  const cacheKey = `nearby:${latitude.toFixed(5)}:${longitude.toFixed(5)}`;
  const now = Date.now();
  const cached = textSearchCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.results;
  }

  const payload = await googlePlacesRequest<GoogleTextSearchResponse>(
    "https://places.googleapis.com/v1/places:searchNearby",
    {
      method: "POST",
      fieldMask:
        "places.id,places.displayName,places.formattedAddress,places.addressComponents,places.nationalPhoneNumber,places.primaryType,places.types",
      body: JSON.stringify({
        includedTypes: ["establishment", "point_of_interest", "store"],
        maxResultCount: SEARCH_LIMIT,
        locationRestriction: {
          circle: {
            center: { latitude, longitude },
            radius: 120
          }
        },
        languageCode: "en"
      })
    }
  );

  const results = (payload.places ?? [])
    .map((place) => mapTextSearchPlace(place))
    .filter((result): result is BusinessSearchResult => Boolean(result))
    .slice(0, SEARCH_LIMIT);

  textSearchCache.set(cacheKey, { results, expiresAt: now + CACHE_TTL_MS });
  return results;
}

function mapPlaceDetails(
  placeId: string,
  payload: GooglePlaceDetailsResponse,
  fallbackName?: string
): BusinessSearchResult {
  const parsed = parseAddressComponents(payload.addressComponents ?? []);
  const name = payload.displayName?.text?.trim() || fallbackName?.trim() || "";
  const phone = payload.nationalPhoneNumber?.trim() ?? "";
  const result: BusinessSearchResult = {
    id: placeId,
    name,
    address: parsed.address,
    city: parsed.city,
    state: parsed.state,
    postalCode: parsed.postalCode,
    phone,
    description: toDescription(parsed)
  };

  if (!result.address && payload.formattedAddress) {
    result.address = payload.formattedAddress;
  }

  result.description = buildResultDescription({
    ...parsed,
    address: result.address,
    formattedAddress: payload.formattedAddress,
    phone
  });

  return result;
}

export async function resolvePlaceForFacility(placeId: string, sessionToken?: string) {
  const normalizedPlaceId = normalizePlaceId(placeId);
  if (!normalizedPlaceId) {
    return null;
  }

  const cacheKey = `facility:${normalizedPlaceId}:${sessionToken ?? "default"}`;
  const now = Date.now();
  const cached = detailsCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.result;
  }

  const encodedPlaceId = encodeURIComponent(normalizedPlaceId);
  const detailsParams = new URLSearchParams();
  if (sessionToken) {
    detailsParams.set("sessionToken", sessionToken);
  }

  const detailsUrl = detailsParams.toString()
    ? `https://places.googleapis.com/v1/places/${encodedPlaceId}?${detailsParams.toString()}`
    : `https://places.googleapis.com/v1/places/${encodedPlaceId}`;

  const payload = await googlePlacesRequest<GooglePlaceDetailsResponse>(detailsUrl, {
    method: "GET",
    fieldMask:
      "addressComponents,formattedAddress,displayName,nationalPhoneNumber,location,types,primaryType"
  });

  const addressResult = mapPlaceDetails(normalizedPlaceId, payload);
  const hasBusinessIdentity =
    Boolean(addressResult.phone) || isBusinessPlace(payload.types, payload.primaryType);

  if (hasBusinessIdentity && !looksLikeStreetAddress(addressResult.name, addressResult.address)) {
    detailsCache.set(cacheKey, { result: addressResult, expiresAt: now + CACHE_TTL_MS });
    return addressResult;
  }

  const latitude = payload.location?.latitude;
  const longitude = payload.location?.longitude;

  if (latitude !== undefined && longitude !== undefined) {
    const nearbyBusinesses = await searchNearbyEstablishments(latitude, longitude);
    const matchedBusiness =
      nearbyBusinesses.find((business) => business.phone) ?? nearbyBusinesses[0];

    if (matchedBusiness) {
      const resolved = mergeBusinessWithAddress(matchedBusiness, addressResult);
      detailsCache.set(cacheKey, { result: resolved, expiresAt: now + CACHE_TTL_MS });
      return resolved;
    }
  }

  const formattedQuery = [
    addressResult.address,
    addressResult.city,
    addressResult.state,
    addressResult.postalCode
  ]
    .filter(Boolean)
    .join(", ");

  if (formattedQuery) {
    const textMatches = await searchPlacesByText(formattedQuery);
    const matchedBusiness =
      textMatches.find(
        (match) =>
          match.phone &&
          !looksLikeStreetAddress(match.name, match.address) &&
          match.city.toLowerCase() === addressResult.city.toLowerCase()
      ) ??
      textMatches.find((match) => match.phone && !looksLikeStreetAddress(match.name, match.address));

    if (matchedBusiness) {
      const resolved = mergeBusinessWithAddress(matchedBusiness, addressResult);
      detailsCache.set(cacheKey, { result: resolved, expiresAt: now + CACHE_TTL_MS });
      return resolved;
    }
  }

  detailsCache.set(cacheKey, { result: addressResult, expiresAt: now + CACHE_TTL_MS });
  return addressResult;
}

export async function searchAddresses(query: string, sessionToken?: string) {
  const normalizedQuery = normalizeQuery(query);
  if (normalizedQuery.length < 3) {
    return [];
  }

  const cacheKey = `place:${normalizedQuery}:${sessionToken ?? "default"}`;
  const now = Date.now();
  const cached = autocompleteCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.results;
  }

  const payload = await googlePlacesRequest<GoogleAutocompleteResponse>(
    "https://places.googleapis.com/v1/places:autocomplete",
    {
      method: "POST",
      fieldMask:
        "suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat,suggestions.placePrediction.text",
      body: JSON.stringify({
        input: query.trim(),
        includedRegionCodes: ["us"],
        languageCode: "en",
        sessionToken: sessionToken || undefined
      })
    }
  );

  const results = (payload.suggestions ?? [])
    .map((suggestion) => mapAutocompleteSuggestion(suggestion))
    .filter((result): result is BusinessSearchResult => Boolean(result))
    .slice(0, SEARCH_LIMIT);

  autocompleteCache.set(cacheKey, { results, expiresAt: now + CACHE_TTL_MS });
  return results;
}

export async function searchAddressSuggestions(query: string, sessionToken?: string) {
  const [autocompleteResults, textResults] = await Promise.all([
    searchAddresses(query, sessionToken),
    searchPlacesByText(query)
  ]);

  const merged = new Map<string, BusinessSearchResult>();

  for (const result of autocompleteResults) {
    merged.set(result.id, result);
  }

  for (const result of textResults) {
    const existing = merged.get(result.id);
    if (existing) {
      merged.set(result.id, {
        ...existing,
        ...result,
        name: result.name || existing.name,
        address: result.address || existing.address,
        city: result.city || existing.city,
        state: result.state || existing.state,
        postalCode: result.postalCode || existing.postalCode,
        phone: result.phone || existing.phone,
        description: result.description || existing.description
      });
    } else {
      merged.set(result.id, result);
    }
  }

  return Array.from(merged.values()).slice(0, SEARCH_LIMIT);
}

export async function searchBusinesses(query: string, sessionToken?: string) {
  const normalizedQuery = normalizeQuery(query);
  if (normalizedQuery.length < 3) {
    return [];
  }

  const cacheKey = `${normalizedQuery}:${sessionToken ?? "default"}`;
  const now = Date.now();
  const cached = autocompleteCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.results;
  }

  const payload = await googlePlacesRequest<GoogleAutocompleteResponse>(
    "https://places.googleapis.com/v1/places:autocomplete",
    {
      method: "POST",
      fieldMask:
        "suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat,suggestions.placePrediction.text",
      body: JSON.stringify({
        input: query.trim(),
        includedRegionCodes: ["us"],
        languageCode: "en",
        sessionToken: sessionToken || undefined
      })
    }
  );

  const results = (payload.suggestions ?? [])
    .map((suggestion) => mapAutocompleteSuggestion(suggestion))
    .filter((result): result is BusinessSearchResult => Boolean(result))
    .slice(0, SEARCH_LIMIT);

  autocompleteCache.set(cacheKey, { results, expiresAt: now + CACHE_TTL_MS });
  return results;
}

export async function getBusinessDetails(
  placeId: string,
  fallbackName?: string,
  sessionToken?: string
) {
  const normalizedPlaceId = normalizePlaceId(placeId);
  if (!normalizedPlaceId) {
    return null;
  }

  const cacheKey = `${normalizedPlaceId}:${sessionToken ?? "default"}`;
  const now = Date.now();
  const cached = detailsCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.result;
  }

  const encodedPlaceId = encodeURIComponent(normalizedPlaceId);
  const detailsParams = new URLSearchParams();
  if (sessionToken) {
    detailsParams.set("sessionToken", sessionToken);
  }

  const detailsUrl = detailsParams.toString()
    ? `https://places.googleapis.com/v1/places/${encodedPlaceId}?${detailsParams.toString()}`
    : `https://places.googleapis.com/v1/places/${encodedPlaceId}`;

  const payload = await googlePlacesRequest<GooglePlaceDetailsResponse>(detailsUrl, {
    method: "GET",
    fieldMask: "addressComponents,formattedAddress,displayName,nationalPhoneNumber"
  });

  const result = mapPlaceDetails(normalizedPlaceId, payload, fallbackName);

  detailsCache.set(cacheKey, { result, expiresAt: now + CACHE_TTL_MS });
  return result;
}
