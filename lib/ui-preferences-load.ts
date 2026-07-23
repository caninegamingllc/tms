import { cache } from "react";
import { prisma } from "@/lib/db";
import { requireTmsAccess } from "@/lib/permissions";
import {
  getPageLayouts,
  parseUiPreferences,
  resolvePageLayouts,
  type PageLayouts,
  type UiPreferences
} from "@/lib/ui-preferences";

export type PageLayoutContext = {
  /** Effective layout: personal override, else org default. */
  layouts: PageLayouts | undefined;
  /** Org-wide default for this page (used on reset). */
  orgDefaultLayouts: PageLayouts | undefined;
  canSetOrgDefault: boolean;
};

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

const loadOrgUiDefaults = cache(async (companyId: string): Promise<UiPreferences> => {
  const row = await prisma.company.findUnique({
    where: { id: companyId },
    select: { uiDefaults: true }
  });

  return parseUiPreferences(row?.uiDefaults);
});

export async function loadPageLayoutContext(pageId: string): Promise<PageLayoutContext> {
  const user = await requireTmsAccess();
  const [preferences, orgDefaults] = await Promise.all([
    loadUiPreferences(),
    loadOrgUiDefaults(user.companyId)
  ]);

  const personal = getPageLayouts(preferences, pageId);
  const orgDefaultLayouts = getPageLayouts(orgDefaults, pageId);

  return {
    layouts: resolvePageLayouts(personal, orgDefaultLayouts),
    orgDefaultLayouts,
    canSetOrgDefault: user.role === "OWNER"
  };
}

/** @deprecated Prefer loadPageLayoutContext — returns effective layouts only. */
export async function loadPageLayouts(pageId: string): Promise<PageLayouts | undefined> {
  const context = await loadPageLayoutContext(pageId);
  return context.layouts;
}
