import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getLoadRoute } from "@/lib/load-route";
import { canAccessRecord } from "@/lib/branch-filter-server";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;
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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const load = await prisma.load.findUnique({
    where: { id, companyId: user.companyId },
    select: { id: true, branchId: true }
  });

  if (!load || !(await canAccessRecord(user, load.branchId))) {
    return NextResponse.json({ error: "Load not found." }, { status: 404 });
  }

  if (isRateLimited(user.id)) {
    return NextResponse.json({ error: "Too many route requests. Try again shortly." }, { status: 429 });
  }

  const refresh = request.nextUrl.searchParams.get("refresh") === "1";

  try {
    const route = await getLoadRoute(load.id, { refresh });
    if (!route) {
      return NextResponse.json({ error: "Load not found." }, { status: 404 });
    }

    return NextResponse.json(route);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Route calculation is unavailable.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
