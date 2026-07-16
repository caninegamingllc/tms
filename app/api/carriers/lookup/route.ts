import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { lookupCarriers } from "@/lib/carrier-lookup";
import { planHasFeature } from "@/lib/plans";
import { isRateLimited } from "@/lib/rate-limit";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 60;

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!planHasFeature(user.plan, "fmcsa_lookup")) {
    return NextResponse.json({ error: "FMCSA lookup requires Lite or Premium." }, { status: 403 });
  }

  const typeParam = request.nextUrl.searchParams.get("type");
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (typeParam !== "mc" && typeParam !== "dot" && typeParam !== "auto") {
    return NextResponse.json({ error: "Lookup type must be mc, dot, or auto." }, { status: 400 });
  }

  if (query.length < 3) {
    return NextResponse.json({ results: [], fmcsaAvailable: false });
  }

  if (await isRateLimited(`carrier-lookup:${user.id}`, RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS)) {
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
