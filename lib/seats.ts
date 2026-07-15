import { prisma } from "@/lib/db";
import {
  getPlan,
  includedSeatQuantity,
  normalizePlanId,
  type PlanId
} from "@/lib/plans";

export type SeatSummary = {
  purchased: number;
  assigned: number;
  available: number;
  subscriptionStatus: string;
  plan: PlanId;
  planName: string;
  maxSeats: number | null;
};

export function canAccessTms(membership: { seatAssignedAt: Date | null }) {
  return membership.seatAssignedAt != null;
}

export function canAccessAdmin(role: string) {
  return role === "OWNER" || role === "ADMIN";
}

export async function getCompanyPlan(companyId: string): Promise<PlanId> {
  const subscription = await prisma.seatSubscription.findUnique({
    where: { companyId },
    select: { plan: true }
  });
  return normalizePlanId(subscription?.plan);
}

export async function getSeatSummary(companyId: string): Promise<SeatSummary> {
  const [subscription, assigned] = await Promise.all([
    prisma.seatSubscription.findUnique({ where: { companyId } }),
    prisma.companyMembership.count({
      where: { companyId, seatAssignedAt: { not: null }, status: { not: "INVITED" } }
    })
  ]);

  const plan = normalizePlanId(subscription?.plan);
  const definition = getPlan(plan);
  const purchased =
    subscription?.seatQuantity && subscription.seatQuantity > 0
      ? subscription.seatQuantity
      : includedSeatQuantity(plan);
  const subscriptionStatus = subscription?.status ?? "NONE";

  return {
    purchased,
    assigned,
    available: Math.max(0, purchased - assigned),
    subscriptionStatus,
    plan,
    planName: definition.name,
    maxSeats: definition.maxSeats
  };
}

export async function assignSeat(membershipId: string, companyId: string) {
  return prisma.$transaction(async (tx) => {
    const [subscription, assigned, membership] = await Promise.all([
      tx.seatSubscription.findUnique({ where: { companyId } }),
      tx.companyMembership.count({
        where: { companyId, seatAssignedAt: { not: null }, status: { not: "INVITED" } }
      }),
      tx.companyMembership.findUniqueOrThrow({ where: { id: membershipId } })
    ]);

    const plan = normalizePlanId(subscription?.plan);
    const purchased =
      subscription?.seatQuantity && subscription.seatQuantity > 0
        ? subscription.seatQuantity
        : includedSeatQuantity(plan);
    const subscriptionStatus = subscription?.status ?? "NONE";
    const available = Math.max(0, purchased - assigned);

    if (available <= 0) {
      throw new Error(
        plan === "FREE"
          ? "Free plan includes only one seat. Upgrade to Lite or Premium to add users."
          : "No available seats. Upgrade your plan or free a seat in Admin."
      );
    }

    if (subscriptionStatus === "CANCELED" || subscriptionStatus === "PAST_DUE") {
      throw new Error("Subscription is not active. Update billing before assigning seats.");
    }

    if (membership.companyId !== companyId) {
      throw new Error("Membership does not belong to this organization.");
    }

    if (membership.status === "INVITED") {
      throw new Error("Pending invites cannot receive a seat until accepted.");
    }

    if (membership.seatAssignedAt) {
      throw new Error("This member already has a seat assigned.");
    }

    return tx.companyMembership.update({
      where: { id: membershipId },
      data: { seatAssignedAt: new Date() }
    });
  });
}

export async function unassignSeat(membershipId: string, companyId: string) {
  return prisma.$transaction(async (tx) => {
    const membership = await tx.companyMembership.findUniqueOrThrow({
      where: { id: membershipId }
    });

    if (membership.companyId !== companyId) {
      throw new Error("Membership does not belong to this organization.");
    }

    if (!membership.seatAssignedAt) {
      throw new Error("This member does not have a seat assigned.");
    }

    return tx.companyMembership.update({
      where: { id: membershipId },
      data: { seatAssignedAt: null }
    });
  });
}

export async function tryAutoAssignSeat(membershipId: string, companyId: string) {
  try {
    await assignSeat(membershipId, companyId);
    return true;
  } catch {
    return false;
  }
}

export async function autoAssignOwnerOnPurchase(companyId: string, actorMembershipId: string) {
  const membership = await prisma.companyMembership.findUnique({
    where: { id: actorMembershipId }
  });

  if (!membership || membership.companyId !== companyId || membership.seatAssignedAt) {
    return;
  }

  await tryAutoAssignSeat(actorMembershipId, companyId);
}

/** When seats shrink (e.g. Free), keep OWNER seats and drop extras. */
export async function pruneSeatsToQuantity(companyId: string, maxSeats: number) {
  const seated = await prisma.companyMembership.findMany({
    where: { companyId, seatAssignedAt: { not: null }, status: { not: "INVITED" } },
    orderBy: [{ role: "asc" }, { seatAssignedAt: "asc" }]
  });

  if (seated.length <= maxSeats) {
    return;
  }

  const owners = seated.filter((member) => member.role === "OWNER");
  const others = seated.filter((member) => member.role !== "OWNER");
  const keepIds = new Set<string>();

  for (const owner of owners) {
    if (keepIds.size >= maxSeats) break;
    keepIds.add(owner.id);
  }

  for (const member of others) {
    if (keepIds.size >= maxSeats) break;
    keepIds.add(member.id);
  }

  const dropIds = seated.filter((member) => !keepIds.has(member.id)).map((member) => member.id);
  if (dropIds.length === 0) {
    return;
  }

  await prisma.companyMembership.updateMany({
    where: { id: { in: dropIds } },
    data: { seatAssignedAt: null }
  });
}
