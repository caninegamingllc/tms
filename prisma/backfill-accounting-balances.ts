import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const invoices = await prisma.invoice.findMany();
  for (const inv of invoices) {
    const balanceCents = inv.status === "PAID" || inv.status === "VOID" ? 0 : inv.totalCents;
    await prisma.invoice.update({ where: { id: inv.id }, data: { balanceCents } });
  }

  const bills = await prisma.carrierBill.findMany({ include: { carrier: true } });
  for (const bill of bills) {
    const balanceCents = bill.status === "PAID" || bill.status === "VOID" ? 0 : bill.totalCents;
    await prisma.carrierBill.update({
      where: { id: bill.id },
      data: {
        balanceCents,
        payeeName: bill.payeeName ?? bill.carrier.name,
        nameOnCheck: bill.nameOnCheck ?? bill.carrier.name
      }
    });
  }

  console.log(`Backfilled ${invoices.length} invoices and ${bills.length} bills`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
