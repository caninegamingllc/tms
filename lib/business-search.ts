export type BusinessSearchResult = {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
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
};

const SEARCH_LIMIT = 8;
const CACHE_TTL_MS = 5 * 60 * 1000;
const autocompleteCache = new Map<string, { expiresAt: number; results: BusinessSearchResult[] }>();
const detailsCache = new Map<string, { expiresAt: number; result: BusinessSearchResult }>();

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

function mapAddressAutocompleteSuggestion(
  suggestion: GoogleAutocompleteSuggestion
): BusinessSearchResult | null {
  const prediction = suggestion.placePrediction;
  const placeId = prediction?.placeId?.trim();
  const address =
    prediction?.structuredFormat?.mainText?.text?.trim() ||
    prediction?.text?.text?.trim() ||
    "";

  if (!placeId || !address) {
    return null;
  }

  const description = prediction?.structuredFormat?.secondaryText?.text?.trim() ?? "";

  return {
    id: placeId,
    name: address,
    address,
    city: "",
    state: "",
    postalCode: "",
    description
  };
}

export async function searchAddresses(query: string, sessionToken?: string) {
  const normalizedQuery = normalizeQuery(query);
  if (normalizedQuery.length < 3) {
    return [];
  }

  const cacheKey = `address:${normalizedQuery}:${sessionToken ?? "default"}`;
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
        includedPrimaryTypes: ["street_address", "premise", "subpremise", "route"],
        includedRegionCodes: ["us"],
        languageCode: "en",
        sessionToken: sessionToken || undefined
      })
    }
  );

  const results = (payload.suggestions ?? [])
    .map((suggestion) => mapAddressAutocompleteSuggestion(suggestion))
    .filter((result): result is BusinessSearchResult => Boolean(result))
    .slice(0, SEARCH_LIMIT);

  autocompleteCache.set(cacheKey, { results, expiresAt: now + CACHE_TTL_MS });
  return results;
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
  const normalizedPlaceId = placeId.trim();
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
    fieldMask: "addressComponents,formattedAddress"
  });

  const parsed = parseAddressComponents(payload.addressComponents ?? []);
  const name = fallbackName?.trim() || "";
  const result: BusinessSearchResult = {
    id: normalizedPlaceId,
    name,
    address: parsed.address,
    city: parsed.city,
    state: parsed.state,
    postalCode: parsed.postalCode,
    description: toDescription(parsed)
  };

  if (!result.address && payload.formattedAddress) {
    result.address = payload.formattedAddress;
    result.description = payload.formattedAddress;
  }

  detailsCache.set(cacheKey, { result, expiresAt: now + CACHE_TTL_MS });
  return result;
}
