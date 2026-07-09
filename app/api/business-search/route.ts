import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getBusinessDetails,
  searchBusinesses,
  searchPlacesByText,
  shouldUseTextSearch
} from "@/lib/business-search";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 60;
const requestWindows = new Map<string, number[]>();

function isRateLimited(userId: string) {
  const now = Date.now();
  const recent = (requestWindows.get(userId) ?? []).filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS
  );

  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    requestWindows.set(userId, recent);
    return true;
  }

  recent.push(now);
  requestWindows.set(userId, recent);
  return false;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionToken = request.nextUrl.searchParams.get("sessionToken")?.trim() || undefined;
  const placeId = request.nextUrl.searchParams.get("placeId")?.trim();
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  try {
    if (placeId) {
      const fallbackName = request.nextUrl.searchParams.get("name")?.trim() || undefined;
      const result = await getBusinessDetails(placeId, fallbackName, sessionToken);
      if (!result) {
        return NextResponse.json({ error: "Business details not found." }, { status: 404 });
      }

      return NextResponse.json({ result });
    }

    if (query.length < 3) {
      return NextResponse.json({ results: [] });
    }

    if (isRateLimited(user.id)) {
      return NextResponse.json({ results: [] });
    }

    const searchType = request.nextUrl.searchParams.get("type")?.trim() || "business";
    let results;

    if (searchType === "address") {
      results = await searchPlacesByText(query);
    } else if (shouldUseTextSearch(query, "name")) {
      results = await searchPlacesByText(query);
    } else {
      results = await searchBusinesses(query, sessionToken);
    }

    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Business search is unavailable.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
