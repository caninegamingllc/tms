/**
 * One-time migration for databases created before the membership model.
 * Run after `prisma db push` if upgrading an existing database:
 *   npx tsx prisma/migrate-to-memberships.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const legacyUsers = await prisma.$queryRaw<
    Array<{
      id: string;
      companyId: string;
      role: string;
      status: string;
      branchId: string | null;
      inviteTokenHash: string | null;
      inviteExpiresAt: Date | null;
      lockedAt: Date | null;
      disabledAt: Date | null;
    }>
  >`SELECT id, companyId, role, status, branchId, inviteTokenHash, inviteExpiresAt, lockedAt, disabledAt FROM User WHERE companyId IS NOT NULL`;

  if (legacyUsers.length === 0) {
    console.log("No legacy users to migrate.");
    return;
  }

  for (const legacyUser of legacyUsers) {
    const membership = await prisma.companyMembership.upsert({
      where: {
        userId_companyId: {
          userId: legacyUser.id,
          companyId: legacyUser.companyId
        }
      },
      create: {
        userId: legacyUser.id,
        companyId: legacyUser.companyId,
        role: legacyUser.role,
        status: legacyUser.status,
        branchId: legacyUser.branchId,
        inviteTokenHash: legacyUser.inviteTokenHash,
        inviteExpiresAt: legacyUser.inviteExpiresAt,
        lockedAt: legacyUser.lockedAt,
        disabledAt: legacyUser.disabledAt,
        seatAssignedAt: legacyUser.status === "ACTIVE" ? new Date() : null
      },
      update: {}
    });

    const assignedCount = await prisma.companyMembership.count({
      where: {
        companyId: legacyUser.companyId,
        seatAssignedAt: { not: null },
        status: { not: "INVITED" }
      }
    });

    await prisma.seatSubscription.upsert({
      where: { companyId: legacyUser.companyId },
      create: {
        companyId: legacyUser.companyId,
        seatQuantity: assignedCount,
        status: assignedCount > 0 ? "ACTIVE" : "NONE"
      },
      update: {
        seatQuantity: assignedCount,
        status: assignedCount > 0 ? "ACTIVE" : "NONE"
      }
    });

    const sessions = await prisma.session.findMany({ where: { userId: legacyUser.id } });
    for (const session of sessions) {
      if (!session.membershipId) {
        await prisma.session.update({
          where: { id: session.id },
          data: { membershipId: membership.id }
        });
      }
    }
  }

  console.log(`Migrated ${legacyUsers.length} legacy users to memberships.`);
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
