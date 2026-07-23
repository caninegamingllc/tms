import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseUiPreferences, setPageLayouts, type PageLayouts } from "@/lib/ui-preferences";

function isPageLayouts(value: unknown): value is PageLayouts {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const layouts = value as PageLayouts;
  return (
    (layouts.lg == null || Array.isArray(layouts.lg)) &&
    (layouts.md == null || Array.isArray(layouts.md)) &&
    (layouts.sm == null || Array.isArray(layouts.sm))
  );
}

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
      setOrgDefault?: boolean;
    };

    if (!body.pageId || typeof body.pageId !== "string") {
      return NextResponse.json({ error: "pageId is required" }, { status: 400 });
    }

    if (body.setOrgDefault) {
      if (user.role !== "OWNER") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (!isPageLayouts(body.layouts) || !body.layouts.lg?.length) {
        return NextResponse.json({ error: "layouts are required" }, { status: 400 });
      }

      const company = await prisma.company.findUnique({
        where: { id: user.companyId },
        select: { uiDefaults: true }
      });

      const next = setPageLayouts(
        parseUiPreferences(company?.uiDefaults),
        body.pageId,
        body.layouts
      );

      await prisma.company.update({
        where: { id: user.companyId },
        data: { uiDefaults: next as Prisma.InputJsonValue }
      });

      return NextResponse.json({ ok: true, orgDefault: true });
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
      data: { uiPreferences: next as Prisma.InputJsonValue }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save layout";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
