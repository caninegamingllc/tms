import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { mergeOnboarding, parseUiPreferences } from "@/lib/ui-preferences";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      tourCompletedAt?: string | null;
      dismissCoachmark?: string;
      resetCoachmarks?: boolean;
      replay?: boolean;
    };

    if (
      body.tourCompletedAt === undefined &&
      body.dismissCoachmark === undefined &&
      body.resetCoachmarks !== true &&
      body.replay !== true
    ) {
      return NextResponse.json({ error: "No onboarding changes provided" }, { status: 400 });
    }

    if (body.dismissCoachmark != null && typeof body.dismissCoachmark !== "string") {
      return NextResponse.json({ error: "dismissCoachmark must be a string" }, { status: 400 });
    }

    if (
      body.tourCompletedAt !== undefined &&
      body.tourCompletedAt !== null &&
      typeof body.tourCompletedAt !== "string"
    ) {
      return NextResponse.json({ error: "tourCompletedAt must be a string or null" }, { status: 400 });
    }

    const row = await prisma.user.findUnique({
      where: { id: user.id },
      select: { uiPreferences: true }
    });

    const next = mergeOnboarding(parseUiPreferences(row?.uiPreferences), {
      tourCompletedAt: body.replay ? null : body.tourCompletedAt,
      dismissCoachmark: body.dismissCoachmark,
      resetCoachmarks: body.replay === true || body.resetCoachmarks === true
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { uiPreferences: next }
    });

    return NextResponse.json({ ok: true, onboarding: next.onboarding ?? {} });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save onboarding";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
