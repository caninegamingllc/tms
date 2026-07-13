import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.findFirst({
    where: { name: "Talent Transport Logistics Inc" }
  });
  if (!company) {
    console.log("no company");
    return;
  }

  const branches = await prisma.branch.findMany({ where: { companyId: company.id } });
  const memberships = await prisma.companyMembership.findMany({
    where: { companyId: company.id },
    include: { user: true, branch: true }
  });

  console.log("branches:");
  for (const branch of branches) {
    console.log(`  ${branch.id} | ${branch.name}`);
  }
  console.log("memberships:");
  for (const membership of memberships) {
    console.log(
      `  ${membership.status} | user=${membership.user.name} | branchId=${membership.branchId} | branch=${membership.branch?.name ?? "null"}`
    );
  }
}

main().finally(() => prisma.$disconnect());
