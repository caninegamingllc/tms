import { prisma } from "@/lib/db";

export type SeatSummary = {
  purchased: number;
  assigned: number;
  available: number;
  subscriptionStatus: string;
};

export function canAccessTms(membership: { seatAssignedAt: Date | null }) {
  return membership.seatAssignedAt != null;
}

export function canAccessAdmin(role: string) {
  return role === "OWNER" || role === "ADMIN";
}

export async function getSeatSummary(companyId: string): Promise<SeatSummary> {
  const [subscription, assigned] = await Promise.all([
    prisma.seatSubscription.findUnique({ where: { companyId } }),
    prisma.companyMembership.count({
      where: { companyId, seatAssignedAt: { not: null }, status: { not: "INVITED" } }
    })
  ]);

  const purchased = subscription?.seatQuantity ?? 0;
  const subscriptionStatus = subscription?.status ?? "NONE";

  return {
    purchased,
    assigned,
    available: Math.max(0, purchased - assigned),
    subscriptionStatus
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

    const purchased = subscription?.seatQuantity ?? 0;
    const subscriptionStatus = subscription?.status ?? "NONE";
    const available = Math.max(0, purchased - assigned);

    if (available <= 0) {
      throw new Error("No available seats. Purchase more seats in Billing.");
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
