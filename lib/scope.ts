import type { SessionUser } from "@/lib/types";

export function isAdminRole(role: string) {
  return role === "OWNER" || role === "ADMIN";
}

export function canSeeAllBranches(user: Pick<SessionUser, "role" | "branchId">) {
  return isAdminRole(user.role) || !user.branchId;
}

export function canManageUsers(user: Pick<SessionUser, "role">) {
  return isAdminRole(user.role);
}

export function canWrite(user: Pick<SessionUser, "role">) {
  return user.role !== "VIEWER";
}

export function companyWhere(user: Pick<SessionUser, "companyId">) {
  return { companyId: user.companyId };
}

export function branchScopedWhere(user: Pick<SessionUser, "companyId" | "role" | "branchId">) {
  const base = companyWhere(user);

  if (canSeeAllBranches(user)) {
    return base;
  }

  return { ...base, branchId: user.branchId };
}

export function canAccessBranchRecord(
  user: Pick<SessionUser, "role" | "branchId">,
  recordBranchId: string | null | undefined
) {
  if (canSeeAllBranches(user)) {
    return true;
  }

  if (!recordBranchId) {
    return false;
  }

  return recordBranchId === user.branchId;
}

export async function resolveBranchId(
  user: Pick<SessionUser, "role" | "branchId" | "companyId">,
  requestedBranchId: string | undefined,
  prisma: { branch: { findUniqueOrThrow: (args: { where: { id: string; companyId: string } }) => Promise<unknown> } }
) {
  if (isAdminRole(user.role) && requestedBranchId) {
    await prisma.branch.findUniqueOrThrow({ where: { id: requestedBranchId, companyId: user.companyId } });
    return requestedBranchId;
  }

  return user.branchId ?? undefined;
}
