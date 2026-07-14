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
  const summary = await getSeatSummary(companyId);

  if (summary.available <= 0) {
    throw new Error("No available seats. Purchase more seats in Billing.");
  }

  if (summary.subscriptionStatus === "CANCELED" || summary.subscriptionStatus === "PAST_DUE") {
    throw new Error("Subscription is not active. Update billing before assigning seats.");
  }

  const membership = await prisma.companyMembership.findUniqueOrThrow({
    where: { id: membershipId }
  });

  if (membership.companyId !== companyId) {
    throw new Error("Membership does not belong to this organization.");
  }

  if (membership.status === "INVITED") {
    throw new Error("Pending invites cannot receive a seat until accepted.");
  }

  if (membership.seatAssignedAt) {
    throw new Error("This member already has a seat assigned.");
  }

  return prisma.companyMembership.update({
    where: { id: membershipId },
    data: { seatAssignedAt: new Date() }
  });
}

export async function unassignSeat(membershipId: string, companyId: string) {
  const membership = await prisma.companyMembership.findUniqueOrThrow({
    where: { id: membershipId }
  });

  if (membership.companyId !== companyId) {
    throw new Error("Membership does not belong to this organization.");
  }

  if (!membership.seatAssignedAt) {
    throw new Error("This member does not have a seat assigned.");
  }

  return prisma.companyMembership.update({
    where: { id: membershipId },
    data: { seatAssignedAt: null }
  });
}

export async function tryAutoAssignSeat(membershipId: string, companyId: string) {
  const summary = await getSeatSummary(companyId);

  if (summary.available <= 0) {
    return false;
  }

  if (summary.subscriptionStatus === "CANCELED" || summary.subscriptionStatus === "PAST_DUE") {
    return false;
  }

  const membership = await prisma.companyMembership.findUnique({
    where: { id: membershipId }
  });

  if (!membership || membership.seatAssignedAt) {
    return false;
  }

  await prisma.companyMembership.update({
    where: { id: membershipId },
    data: { seatAssignedAt: new Date() }
  });

  return true;
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
