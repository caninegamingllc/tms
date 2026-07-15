import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseUiPreferences, setPageLayouts, type PageLayouts } from "@/lib/ui-preferences";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      pageId?: string;
      layouts?: PageLayouts | null;
      reset?: boolean;
    };

    if (!body.pageId || typeof body.pageId !== "string") {
      return NextResponse.json({ error: "pageId is required" }, { status: 400 });
    }

    const row = await prisma.user.findUnique({
      where: { id: user.id },
      select: { uiPreferences: true }
    });

    const next = setPageLayouts(
      parseUiPreferences(row?.uiPreferences),
      body.pageId,
      body.reset ? null : (body.layouts ?? null)
    );

    await prisma.user.update({
      where: { id: user.id },
      data: { uiPreferences: next }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save layout";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
