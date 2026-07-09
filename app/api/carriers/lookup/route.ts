import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { lookupCarriers } from "@/lib/carrier-lookup";

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

  const typeParam = request.nextUrl.searchParams.get("type");
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (typeParam !== "mc" && typeParam !== "dot") {
    return NextResponse.json({ error: "Lookup type must be mc or dot." }, { status: 400 });
  }

  if (query.length < 3) {
    return NextResponse.json({ results: [], fmcsaAvailable: false });
  }

  if (isRateLimited(user.id)) {
    return NextResponse.json({ results: [], fmcsaAvailable: false });
  }

  try {
    const payload = await lookupCarriers(user.companyId, typeParam, query);
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Carrier lookup is unavailable.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
