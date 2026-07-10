import { prisma } from "@/lib/db";
import { requireTmsAccess } from "@/lib/permissions";
import { branchScopedWhere } from "@/lib/scope";

export async function getDashboardData() {
  const user = await requireTmsAccess();
  const loadScope = branchScopedWhere(user);

  const [loads, customers, carriers, invoices, carrierBills, checkCalls] = await Promise.all([
    prisma.load.findMany({
      where: loadScope,
      orderBy: { pickupDate: "asc" },
      include: {
        customer: true,
        dispatchAssignment: { include: { carrier: true } }
      },
      take: 8
    }),
    prisma.customer.count({ where: branchScopedWhere(user) }),
    prisma.carrier.count({ where: { companyId: user.companyId } }),
    prisma.invoice.findMany({
      where: {
        companyId: user.companyId,
        load: loadScope
      },
      include: { customer: true, load: true }
    }),
    prisma.carrierBill.findMany({
      where: {
        companyId: user.companyId,
        load: loadScope
      },
      include: { carrier: true, load: true }
    }),
    prisma.checkCall.findMany({
      where: {
        assignment: {
          load: loadScope
        }
      },
      orderBy: { occurredAt: "desc" },
      include: {
        assignment: {
          include: {
            load: true,
            carrier: true
          }
        }
      },
      take: 5
    })
  ]);

  const activeLoads = loads.filter((load) =>
    ["AVAILABLE", "COVERED", "DISPATCHED", "PICKED_UP"].includes(load.status)
  );
  const revenueCents = loads.reduce((sum, load) => sum + load.revenueCents, 0);
  const marginCents = loads.reduce(
    (sum, load) => sum + load.revenueCents - load.carrierCostCents,
    0
  );
  const openArCents = invoices
    .filter((invoice) => invoice.status !== "PAID" && invoice.status !== "VOID")
    .reduce((sum, invoice) => sum + invoice.totalCents, 0);
  const openApCents = carrierBills
    .filter((bill) => bill.status !== "PAID" && bill.status !== "VOID")
    .reduce((sum, bill) => sum + bill.totalCents, 0);

  return {
    loads,
    activeLoads,
    customers,
    carriers,
    invoices,
    carrierBills,
    checkCalls,
    revenueCents,
    marginCents,
    openArCents,
    openApCents
  };
}

export async function getLoadOptions() {
  const user = await requireTmsAccess();
  const [customers, carriers] = await Promise.all([
    prisma.customer.findMany({ where: branchScopedWhere(user), orderBy: { name: "asc" } }),
    prisma.carrier.findMany({ where: { companyId: user.companyId }, orderBy: { name: "asc" } })
  ]);

  return { customers, carriers };
}
