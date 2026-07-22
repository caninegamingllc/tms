import { cache } from "react";
import { prisma } from "@/lib/db";
import { requireTmsAccess } from "@/lib/permissions";
import {
  getPageLayouts,
  parseUiPreferences,
  type PageLayouts,
  type UiPreferences
} from "@/lib/ui-preferences";

export const loadUiPreferencesForUser = cache(async (userId: string): Promise<UiPreferences> => {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { uiPreferences: true }
  });

  return parseUiPreferences(row?.uiPreferences);
});

export const loadUiPreferences = cache(async (): Promise<UiPreferences> => {
  const user = await requireTmsAccess();
  return loadUiPreferencesForUser(user.id);
});

export async function loadPageLayouts(pageId: string): Promise<PageLayouts | undefined> {
  const preferences = await loadUiPreferences();
  return getPageLayouts(preferences, pageId);
}
