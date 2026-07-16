import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPlaceLocation, searchAddresses } from "@/lib/business-search";
import { planHasFeature } from "@/lib/plans";
import { isRateLimited } from "@/lib/rate-limit";
import { canWrite } from "@/lib/scope";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 60;

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canWrite(user)) {
    return NextResponse.json({ error: "You do not have permission to modify data." }, { status: 403 });
  }

  if (!planHasFeature(user.plan, "check_calls")) {
    return NextResponse.json({ error: "Check calls are not available on this plan." }, { status: 403 });
  }

  if (await isRateLimited(`check-call-location:${user.id}`, RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS)) {
    return NextResponse.json({ results: [] }, { status: 429 });
  }

  const sessionToken = request.nextUrl.searchParams.get("sessionToken")?.trim() || undefined;
  const placeId = request.nextUrl.searchParams.get("placeId")?.trim();
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  try {
    if (placeId) {
      const result = await getPlaceLocation(placeId, sessionToken);
      if (!result) {
        return NextResponse.json({ error: "Location details not found." }, { status: 404 });
      }

      return NextResponse.json({ result });
    }

    if (query.length < 3) {
      return NextResponse.json({ results: [] });
    }

    const results = await searchAddresses(query, sessionToken);
    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Location search is unavailable.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
