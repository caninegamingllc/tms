import { prisma } from "@/lib/db";

export async function getMembershipBranchIds(membershipId: string): Promise<string[]> {
  const rows = await prisma.membershipBranch.findMany({
    where: { membershipId },
    select: { branchId: true },
    orderBy: { createdAt: "asc" }
  });

  return rows.map((row) => row.branchId);
}

export async function getMembershipBranchIdsMap(
  membershipIds: string[]
): Promise<Map<string, string[]>> {
  if (membershipIds.length === 0) {
    return new Map();
  }

  const rows = await prisma.membershipBranch.findMany({
    where: { membershipId: { in: membershipIds } },
    select: { membershipId: true, branchId: true },
    orderBy: { createdAt: "asc" }
  });

  const map = new Map<string, string[]>();
  for (const row of rows) {
    const current = map.get(row.membershipId) ?? [];
    current.push(row.branchId);
    map.set(row.membershipId, current);
  }

  return map;
}

export async function setMembershipBranches(
  membershipId: string,
  companyId: string,
  branchIds: string[],
  primaryBranchId?: string | null
) {
  const uniqueBranchIds = [...new Set(branchIds)];

  for (const branchId of uniqueBranchIds) {
    await prisma.branch.findUniqueOrThrow({ where: { id: branchId, companyId } });
  }

  const resolvedPrimary =
    primaryBranchId && uniqueBranchIds.includes(primaryBranchId)
      ? primaryBranchId
      : uniqueBranchIds[0] ?? null;

  await prisma.$transaction([
    prisma.membershipBranch.deleteMany({ where: { membershipId } }),
    ...(uniqueBranchIds.length > 0
      ? [
          prisma.membershipBranch.createMany({
            data: uniqueBranchIds.map((branchId) => ({ membershipId, branchId }))
          })
        ]
      : []),
    prisma.companyMembership.update({
      where: { id: membershipId },
      data: { branchId: resolvedPrimary }
    })
  ]);
}

export async function ensureMembershipBranchesSynced(membershipId: string, branchId: string | null) {
  const existing = await getMembershipBranchIds(membershipId);

  if (existing.length > 0) {
    return existing;
  }

  if (!branchId) {
    return [];
  }

  await prisma.membershipBranch.create({
    data: { membershipId, branchId }
  });

  return [branchId];
}
