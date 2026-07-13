import type { SessionUser } from "@/lib/types";

export function isAdminRole(role: string) {
  return role === "OWNER" || role === "ADMIN";
}

export function canManageUsers(user: Pick<SessionUser, "role">) {
  return isAdminRole(user.role);
}

export function canSettleCommission(user: Pick<SessionUser, "role">) {
  return user.role === "OWNER" || user.role === "ADMIN" || user.role === "ACCOUNTING";
}

export function canWrite(user: Pick<SessionUser, "role">) {
  return user.role !== "VIEWER";
}

export function companyWhere(user: Pick<SessionUser, "companyId">) {
  return { companyId: user.companyId };
}

/** Admins and legacy users with no branch assignment see all company branches. */
export function canSeeAllBranches(user: Pick<SessionUser, "role" | "branchId" | "branchIds">) {
  return isAdminRole(user.role) || (user.branchIds.length === 0 && !user.branchId);
}

/** Whether the user can pick a branch when creating records. */
export function canPickBranch(user: Pick<SessionUser, "role" | "branchIds">) {
  return isAdminRole(user.role) || user.branchIds.length > 1;
}

/** Whether the header branch switcher should be shown. */
export function hasBranchSwitcher(user: Pick<SessionUser, "role" | "branchIds">) {
  return isAdminRole(user.role) || user.branchIds.length > 1;
}

export function getAllowedBranchIds(
  user: Pick<SessionUser, "role" | "branchId" | "branchIds">
): string[] | null {
  if (isAdminRole(user.role)) {
    return null;
  }

  if (user.branchIds.length > 0) {
    return user.branchIds;
  }

  if (user.branchId) {
    return [user.branchId];
  }

  return null;
}

export type BranchScope = {
  companyId: string;
  branchId?: string | { in: string[] } | null;
};

function resolveBranchFilter(
  allowed: string[] | null,
  selectedBranchIds?: string[] | null
): string | { in: string[] } | undefined {
  if (allowed === null) {
    if (selectedBranchIds && selectedBranchIds.length > 0) {
      return { in: selectedBranchIds };
    }

    return undefined;
  }

  if (allowed.length === 0) {
    return undefined;
  }

  if (!selectedBranchIds || selectedBranchIds.length === 0) {
    if (allowed.length === 1) {
      return allowed[0];
    }

    return { in: allowed };
  }

  const filtered = selectedBranchIds.filter((id) => allowed.includes(id));

  if (filtered.length === 0) {
    if (allowed.length === 1) {
      return allowed[0];
    }

    return { in: allowed };
  }

  if (filtered.length === 1) {
    return filtered[0];
  }

  return { in: filtered };
}

export function branchScopedWhere(
  user: Pick<SessionUser, "companyId" | "role" | "branchId" | "branchIds">,
  selectedBranchIds?: string[] | null
): BranchScope {
  const base = companyWhere(user);
  const allowed = getAllowedBranchIds(user);
  const branchId = resolveBranchFilter(allowed, selectedBranchIds);

  if (branchId === undefined) {
    return base;
  }

  return { ...base, branchId };
}

export function canAccessBranchRecord(
  user: Pick<SessionUser, "role" | "branchId" | "branchIds">,
  recordBranchId: string | null | undefined,
  selectedBranchIds?: string[] | null
) {
  if (!recordBranchId) {
    return canSeeAllBranches(user);
  }

  const allowed = getAllowedBranchIds(user);

  if (allowed !== null && !allowed.includes(recordBranchId)) {
    return false;
  }

  if (!selectedBranchIds || selectedBranchIds.length === 0) {
    return true;
  }

  return selectedBranchIds.includes(recordBranchId);
}

export async function resolveBranchId(
  user: Pick<SessionUser, "role" | "branchId" | "branchIds" | "companyId">,
  requestedBranchId: string | undefined,
  prisma: { branch: { findUniqueOrThrow: (args: { where: { id: string; companyId: string } }) => Promise<unknown> } }
) {
  if (isAdminRole(user.role) && requestedBranchId) {
    await prisma.branch.findUniqueOrThrow({ where: { id: requestedBranchId, companyId: user.companyId } });
    return requestedBranchId;
  }

  if (requestedBranchId && user.branchIds.includes(requestedBranchId)) {
    return requestedBranchId;
  }

  return user.branchId ?? user.branchIds[0] ?? undefined;
}
