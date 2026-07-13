import { cookies } from "next/headers";
import type { SessionUser } from "@/lib/types";
import {
  branchScopedWhere,
  canAccessBranchRecord,
  getAllowedBranchIds,
  hasBranchSwitcher,
  type BranchScope
} from "@/lib/scope";
import { prisma } from "@/lib/db";
import type { BranchOption, BranchSwitcherData } from "@/lib/branch-filter";

export const branchFilterCookieName = "tms_branch_filter";

function parseBranchFilterCookie(value: string | undefined): string[] {
  if (!value?.trim()) {
    return [];
  }

  return value
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export async function getBranchFilterCookie(): Promise<string[]> {
  const cookieStore = await cookies();
  return parseBranchFilterCookie(cookieStore.get(branchFilterCookieName)?.value);
}

async function getAvailableBranches(
  user: Pick<SessionUser, "companyId" | "role" | "branchId" | "branchIds">
): Promise<BranchOption[]> {
  const allowed = getAllowedBranchIds(user);

  if (allowed === null) {
    return prisma.branch.findMany({
      where: { companyId: user.companyId },
      orderBy: { name: "asc" },
      select: { id: true, name: true }
    });
  }

  if (allowed.length === 0) {
    return [];
  }

  return prisma.branch.findMany({
    where: { companyId: user.companyId, id: { in: allowed } },
    orderBy: { name: "asc" },
    select: { id: true, name: true }
  });
}

export async function getEffectiveBranchFilter(
  user: Pick<SessionUser, "companyId" | "role" | "branchId" | "branchIds">
): Promise<string[] | undefined> {
  if (!hasBranchSwitcher(user)) {
    const allowed = getAllowedBranchIds(user);
    if (allowed?.length === 1) {
      return allowed;
    }

    return undefined;
  }

  const [branches, cookieValue] = await Promise.all([getAvailableBranches(user), getBranchFilterCookie()]);

  if (cookieValue.length === 0) {
    return undefined;
  }

  const validIds = new Set(branches.map((branch) => branch.id));
  const selected = cookieValue.filter((id) => validIds.has(id));

  return selected.length > 0 ? selected : undefined;
}

export async function getBranchScope(
  user: Pick<SessionUser, "companyId" | "role" | "branchId" | "branchIds">
): Promise<BranchScope> {
  const filter = await getEffectiveBranchFilter(user);
  return branchScopedWhere(user, filter);
}

export async function canAccessRecord(
  user: Pick<SessionUser, "role" | "branchId" | "branchIds" | "companyId">,
  recordBranchId: string | null | undefined
) {
  const filter = await getEffectiveBranchFilter(user);
  return canAccessBranchRecord(user, recordBranchId, filter);
}

export async function getBranchSwitcherData(
  user: Pick<SessionUser, "companyId" | "role" | "branchId" | "branchIds">
): Promise<BranchSwitcherData | null> {
  if (!hasBranchSwitcher(user)) {
    return null;
  }

  const [branches, cookieValue] = await Promise.all([getAvailableBranches(user), getBranchFilterCookie()]);
  const validIds = new Set(branches.map((branch) => branch.id));
  const selectedBranchIds = cookieValue.filter((id) => validIds.has(id));
  const allSelected = selectedBranchIds.length === 0 || selectedBranchIds.length === branches.length;
  const primaryBranchId =
    user.branchId && validIds.has(user.branchId) ? user.branchId : branches[0]?.id ?? null;

  return { branches, selectedBranchIds, allSelected, primaryBranchId };
}
