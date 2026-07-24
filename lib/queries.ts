import { prisma } from "@/lib/db";
import { requireTmsAccess } from "@/lib/permissions";
import { getBranchScope } from "@/lib/branch-filter-server";

export async function getDashboardData() {
  const user = await requireTmsAccess();
  const loadScope = await getBranchScope(user);
  const customerScope = loadScope;
  const checkCallInclude = {
    assignment: {
      include: {
        load: true,
        carrier: true
      }
    }
  } as const;

  const [
    loads,
    customers,
    carriers,
    openArAgg,
    openApAgg,
    recentCheckCalls,
    nextCheckCalls,
    financialAgg,
    uninvoicedLoads
  ] = await Promise.all([
      prisma.load.findMany({
        where: loadScope,
        orderBy: [{ pickupDate: "desc" }, { loadNumber: "desc" }],
        include: {
          customer: true,
          dispatchAssignments: {
            orderBy: { sequence: "asc" },
            include: { carrier: true }
          }
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
        include: checkCallInclude,
        take: 25
      }),
      prisma.checkCall.findMany({
        where: {
          nextCheckAt: { not: null },
          assignment: {
            load: loadScope
          }
        },
        orderBy: { nextCheckAt: "asc" },
        include: checkCallInclude,
        take: 25
      }),
      prisma.load.aggregate({
        where: loadScope,
        _sum: { revenueCents: true, carrierCostCents: true }
      }),
      prisma.load.findMany({
        where: {
          ...loadScope,
          status: "DELIVERED"
        },
        orderBy: [{ deliveryDate: "asc" }, { deliveredAt: "asc" }],
        include: { customer: { select: { name: true } } },
        take: 25
      })
    ]);
  const checkCalls = [
    ...nextCheckCalls.map((call) => ({
      ...call,
      dashboardKind: "next" as const,
      dashboardAt: call.nextCheckAt ?? call.occurredAt
    })),
    ...recentCheckCalls.map((call) => ({
      ...call,
      dashboardKind: "recent" as const,
      dashboardAt: call.occurredAt
    }))
  ]
    .sort((a, b) => {
      if (a.dashboardKind !== b.dashboardKind) {
        return a.dashboardKind === "next" ? -1 : 1;
      }

      const aTime = a.dashboardAt.getTime();
      const bTime = b.dashboardAt.getTime();

      return a.dashboardKind === "next" ? aTime - bTime : bTime - aTime;
    })
    .slice(0, 25);

  const activeLoads = loads.filter((load) =>
    ["PENDING", "AVAILABLE", "COVERED", "DISPATCHED", "PICKED_UP"].includes(load.status)
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
    openApCents,
    uninvoicedLoads: uninvoicedLoads.map((load) => ({
      id: load.id,
      loadNumber: load.loadNumber,
      customerName: load.customer.name,
      // Age from scheduled/actual delivery date, not when status was clicked to DELIVERED.
      deliveredAt: load.deliveryDate ?? load.deliveredAt
    }))
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
