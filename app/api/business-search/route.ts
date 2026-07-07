import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getBusinessDetails, searchBusinesses } from "@/lib/business-search";

const RATE_LIMIT_WINDOW_MS = 1000;
const requestWindow = new Map<string, number>();

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }

  const realIp = request.headers.get("x-real-ip");
  return realIp?.trim() || "unknown";
}

function isRateLimited(clientIp: string) {
  const now = Date.now();
  const previous = requestWindow.get(clientIp);
  if (previous && now - previous < RATE_LIMIT_WINDOW_MS) {
    return true;
  }

  requestWindow.set(clientIp, now);
  return false;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientIp = getClientIp(request);
  if (isRateLimited(clientIp)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
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

    const results = await searchBusinesses(query, sessionToken);
    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Business search is unavailable.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
