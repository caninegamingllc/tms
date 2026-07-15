"use server";

import { prisma } from "@/lib/db";
import { requireTmsAccess } from "@/lib/permissions";
import { setPageLayouts, type PageLayouts } from "@/lib/ui-preferences";

export async function saveUiLayout(pageId: string, layouts: PageLayouts) {
  const user = await requireTmsAccess();
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { uiPreferences: true }
  });

  const next = setPageLayouts(row?.uiPreferences, pageId, layouts);

  await prisma.user.update({
    where: { id: user.id },
    data: { uiPreferences: next }
  });

  return { ok: true as const };
}

export async function resetUiLayout(pageId: string) {
  const user = await requireTmsAccess();
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { uiPreferences: true }
  });

  const next = setPageLayouts(row?.uiPreferences, pageId, null);

  await prisma.user.update({
    where: { id: user.id },
    data: { uiPreferences: next }
  });

  return { ok: true as const };
}
