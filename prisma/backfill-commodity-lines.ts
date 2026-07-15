import { prisma } from "../lib/db";

async function main() {
  const loads = await prisma.load.findMany({
    select: {
      id: true,
      commodity: true,
      weight: true,
      _count: { select: { commodityLines: true } }
    }
  });

  let created = 0;

  for (const load of loads) {
    if (load._count.commodityLines > 0) {
      continue;
    }

    await prisma.loadCommodityLine.create({
      data: {
        loadId: load.id,
        sequence: 1,
        quantity: 1,
        description: load.commodity?.trim() || "General freight",
        weightLbs: load.weight ?? 0
      }
    });
    created += 1;
  }

  console.log(`Backfilled ${created} load commodity line(s) from ${loads.length} load(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
