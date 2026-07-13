export type LatLng = {
  latitude: number;
  longitude: number;
};

type GeocodeResponse = {
  status: string;
  results?: Array<{
    geometry: {
      location: { lat: number; lng: number };
    };
  }>;
  error_message?: string;
};

type RoutesResponse = {
  routes?: Array<{
    distanceMeters?: number;
    polyline?: {
      encodedPolyline?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

function getGoogleMapsApiKey() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GOOGLE_PLACES_API_KEY is not configured.");
  }

  return apiKey;
}

export async function geocodeAddress(address: string): Promise<LatLng | null> {
  const apiKey = getGoogleMapsApiKey();
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("region", "us");

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Geocoding request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as GeocodeResponse;
  if (payload.status !== "OK" || !payload.results?.length) {
    return null;
  }

  const location = payload.results[0].geometry.location;
  return {
    latitude: location.lat,
    longitude: location.lng
  };
}

export async function computeDrivingRoute(waypoints: LatLng[]) {
  if (waypoints.length < 2) {
    throw new Error("At least two waypoints are required to compute a route.");
  }

  const apiKey = getGoogleMapsApiKey();
  const origin = waypoints[0];
  const destination = waypoints[waypoints.length - 1];
  const intermediates = waypoints.slice(1, -1).map((point) => ({
    location: {
      latLng: {
        latitude: point.latitude,
        longitude: point.longitude
      }
    }
  }));

  const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "routes.distanceMeters,routes.polyline.encodedPolyline"
    },
    body: JSON.stringify({
      origin: {
        location: {
          latLng: {
            latitude: origin.latitude,
            longitude: origin.longitude
          }
        }
      },
      destination: {
        location: {
          latLng: {
            latitude: destination.latitude,
            longitude: destination.longitude
          }
        }
      },
      intermediates,
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_UNAWARE",
      computeAlternativeRoutes: false,
      units: "IMPERIAL"
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as RoutesResponse | null;
    const message = payload?.error?.message ?? `Routes request failed with status ${response.status}.`;
    throw new Error(message);
  }

  const payload = (await response.json()) as RoutesResponse;
  const route = payload.routes?.[0];
  const encodedPolyline = route?.polyline?.encodedPolyline;
  const distanceMeters = route?.distanceMeters;

  if (!encodedPolyline || distanceMeters === undefined) {
    throw new Error("No driving route was found for these stops.");
  }

  return {
    encodedPolyline,
    totalMiles: metersToMiles(distanceMeters)
  };
}

export function metersToMiles(meters: number) {
  return Math.round((meters / 1609.344) * 10) / 10;
}

export function decodePolyline(encoded: string): Array<[number, number]> {
  const coordinates: Array<[number, number]> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    coordinates.push([lat / 1e5, lng / 1e5]);
  }

  return coordinates;
}
