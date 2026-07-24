import { prisma } from "@/lib/db";

/**
 * Allocate the next INV-#### for a company from the highest existing numeric
 * suffix (not row count — gaps/deletes make count-based numbers collide).
 */
export async function nextInvoiceNumber(companyId: string): Promise<string> {
  const latest = await prisma.invoice.findFirst({
    where: { companyId, invoiceNo: { startsWith: "INV-" } },
    orderBy: { invoiceNo: "desc" },
    select: { invoiceNo: true }
  });
  const match = latest?.invoiceNo.match(/^INV-(\d+)$/i);
  const next = match ? Number(match[1]) + 1 : 1001;
  return `INV-${String(next).padStart(4, "0")}`;
}
