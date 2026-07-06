import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { searchBusinesses } from "@/lib/business-search";

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

  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 3) {
    return NextResponse.json({ results: [] });
  }

  const clientIp = getClientIp(request);
  if (isRateLimited(clientIp)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const results = await searchBusinesses(query);
  return NextResponse.json({ results });
}
