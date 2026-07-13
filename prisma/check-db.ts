import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.findFirst({
    where: { name: "Talent Transport Logistics Inc" },
    include: {
      branches: { orderBy: { name: "asc" } },
      memberships: { include: { user: true, branch: true } },
      _count: { select: { loads: true, customers: true, carriers: true } }
    }
  });

  if (!company) {
    console.log("Company not found");
    return;
  }

  console.log("Company:", company.name);
  console.log("Total loads:", company._count.loads);
  console.log("Total customers:", company._count.customers);
  console.log("Total carriers:", company._count.carriers);
  console.log("\nBranches:");
  for (const branch of company.branches) {
    const count = await prisma.load.count({ where: { branchId: branch.id } });
    console.log(`  ${branch.name}: ${count} loads`);
  }
  console.log("\nUsers:");
  for (const membership of company.memberships) {
    console.log(
      `  ${membership.user.name} (${membership.role}) -> ${membership.branch?.name ?? "no branch"}`
    );
  }

  const multiStop = await prisma.load.findFirst({
    where: { companyId: company.id, loadNumber: "1082" },
    include: { stops: { orderBy: { sequence: "asc" } } }
  });
  console.log("\nSample load 1082 stops:", multiStop?.stops.map((s) => `${s.sequence}. ${s.type} ${s.facilityName}`));
}

main().finally(() => prisma.$disconnect());
