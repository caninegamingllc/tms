import { prisma } from "@/lib/db";
import { requireTmsAccess } from "@/lib/permissions";
import { getBranchScope } from "@/lib/branch-filter-server";

export async function getDashboardData() {
  const user = await requireTmsAccess();
  const loadScope = await getBranchScope(user);
  const customerScope = loadScope;

  const [loads, customers, carriers, openArAgg, openApAgg, checkCalls, financialAgg] =
    await Promise.all([
      prisma.load.findMany({
        where: loadScope,
        orderBy: [{ pickupDate: "desc" }, { loadNumber: "desc" }],
        include: {
          customer: true,
          dispatchAssignment: { include: { carrier: true } }
        },
        take: 8
      }),
      prisma.customer.count({ where: customerScope }),
      prisma.carrier.count({ where: loadScope }),
      prisma.invoice.aggregate({
        where: {
          companyId: user.companyId,
          load: loadScope,
          status: { notIn: ["PAID", "VOID"] }
        },
        _sum: { totalCents: true }
      }),
      prisma.carrierBill.aggregate({
        where: {
          companyId: user.companyId,
          load: loadScope,
          status: { notIn: ["PAID", "VOID"] }
        },
        _sum: { totalCents: true }
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
      }),
      prisma.load.aggregate({
        where: loadScope,
        _sum: { revenueCents: true, carrierCostCents: true }
      })
    ]);

  const activeLoads = loads.filter((load) =>
    ["AVAILABLE", "COVERED", "DISPATCHED", "PICKED_UP"].includes(load.status)
  );
  const revenueCents = financialAgg._sum.revenueCents ?? 0;
  const marginCents = revenueCents - (financialAgg._sum.carrierCostCents ?? 0);
  const openArCents = openArAgg._sum.totalCents ?? 0;
  const openApCents = openApAgg._sum.totalCents ?? 0;

  return {
    loads,
    activeLoads,
    customers,
    carriers,
    invoices: [],
    carrierBills: [],
    checkCalls,
    revenueCents,
    marginCents,
    openArCents,
    openApCents
  };
}

export async function getLoadOptions() {
  const user = await requireTmsAccess();
  const scope = await getBranchScope(user);
  const [customers, carriers] = await Promise.all([
    prisma.customer.findMany({
      where: scope,
      orderBy: { name: "asc" },
      select: { id: true, name: true }
    }),
    prisma.carrier.findMany({
      where: scope,
      orderBy: { name: "asc" },
      select: { id: true, name: true }
    })
  ]);

  return { customers, carriers };
}
