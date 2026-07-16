import { z } from "zod";
import { carrierDisplayName } from "@/lib/dispatch-assignment";
import { prisma } from "@/lib/db";
import type { BranchScope } from "@/lib/scope";
import type { Prisma } from "@prisma/client";
import {
  DEFAULT_PAGE_SIZE,
  paginationSkipTake,
  toPaginatedResult,
  type PageSize,
  type PaginatedResult
} from "@/lib/pagination";

export const loadSearchViewSchema = z.enum(["loads", "revenue"]);
export type LoadSearchView = z.infer<typeof loadSearchViewSchema>;

export const loadSearchFiltersSchema = z.object({
  loadNumber: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  customerId: z.string().optional(),
  originCity: z.string().optional(),
  originState: z.string().optional(),
  destCity: z.string().optional(),
  destState: z.string().optional(),
  equipmentType: z.string().optional(),
  commodity: z.string().optional(),
  view: loadSearchViewSchema.optional()
});

export type LoadSearchFilters = z.infer<typeof loadSearchFiltersSchema>;

export type SearchLoadResult = Awaited<ReturnType<typeof searchLoads>>["items"][number];

function startOfDay(dateStr: string) {
  const date = new Date(`${dateStr}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function endOfDay(dateStr: string) {
  const date = new Date(`${dateStr}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function normalizeOptional(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function parseLoadSearchParams(
  searchParams: Record<string, string | string[] | undefined>
): LoadSearchFilters {
  const raw = {
    loadNumber: typeof searchParams.loadNumber === "string" ? searchParams.loadNumber : undefined,
    dateFrom: typeof searchParams.dateFrom === "string" ? searchParams.dateFrom : undefined,
    dateTo: typeof searchParams.dateTo === "string" ? searchParams.dateTo : undefined,
    customerId: typeof searchParams.customerId === "string" ? searchParams.customerId : undefined,
    originCity: typeof searchParams.originCity === "string" ? searchParams.originCity : undefined,
    originState: typeof searchParams.originState === "string" ? searchParams.originState : undefined,
    destCity: typeof searchParams.destCity === "string" ? searchParams.destCity : undefined,
    destState: typeof searchParams.destState === "string" ? searchParams.destState : undefined,
    equipmentType:
      typeof searchParams.equipmentType === "string" ? searchParams.equipmentType : undefined,
    commodity: typeof searchParams.commodity === "string" ? searchParams.commodity : undefined,
    view: typeof searchParams.view === "string" ? searchParams.view : undefined
  };

  const parsed = loadSearchFiltersSchema.safeParse(raw);
  return parsed.success ? parsed.data : {};
}

export function buildLoadSearchWhere(
  scope: BranchScope,
  filters: LoadSearchFilters
): Prisma.LoadWhereInput {
  const where: Prisma.LoadWhereInput = { ...scope };

  const loadNumber = normalizeOptional(filters.loadNumber);
  if (loadNumber) {
    where.loadNumber = { contains: loadNumber, mode: "insensitive" };
  }

  const dateFrom = normalizeOptional(filters.dateFrom);
  const dateTo = normalizeOptional(filters.dateTo);

  if (dateFrom || dateTo) {
    where.pickupDate = {};
    if (dateFrom) {
      const from = startOfDay(dateFrom);
      if (from) {
        where.pickupDate.gte = from;
      }
    }
    if (dateTo) {
      const to = endOfDay(dateTo);
      if (to) {
        where.pickupDate.lte = to;
      }
    }
  }

  const customerId = normalizeOptional(filters.customerId);
  if (customerId) {
    where.customerId = customerId;
  }

  const originCity = normalizeOptional(filters.originCity);
  if (originCity) {
    where.pickupCity = { contains: originCity, mode: "insensitive" };
  }

  const originState = normalizeOptional(filters.originState)?.toUpperCase();
  if (originState) {
    where.pickupState = originState;
  }

  const destCity = normalizeOptional(filters.destCity);
  if (destCity) {
    where.deliveryCity = { contains: destCity, mode: "insensitive" };
  }

  const destState = normalizeOptional(filters.destState)?.toUpperCase();
  if (destState) {
    where.deliveryState = destState;
  }

  const equipmentType = normalizeOptional(filters.equipmentType);
  if (equipmentType) {
    where.equipmentType = equipmentType;
  }

  const commodity = normalizeOptional(filters.commodity);
  if (commodity) {
    where.commodity = { contains: commodity };
  }

  return where;
}

export function hasActiveLoadFilters(filters: LoadSearchFilters) {
  return Boolean(
    filters.loadNumber?.trim() ||
      filters.dateFrom?.trim() ||
      filters.dateTo?.trim() ||
      filters.customerId?.trim() ||
      filters.originCity?.trim() ||
      filters.originState?.trim() ||
      filters.destCity?.trim() ||
      filters.destState?.trim() ||
      filters.equipmentType?.trim() ||
      filters.commodity?.trim()
  );
}

export function buildSearchQueryString(filters: LoadSearchFilters) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value?.trim()) {
      params.set(key, value.trim());
    }
  }

  return params.toString();
}

export function describeActiveFilters(filters: LoadSearchFilters, customerName?: string) {
  const parts: string[] = [];

  if (filters.loadNumber) {
    parts.push(`Load #: ${filters.loadNumber}`);
  }
  if (filters.dateFrom || filters.dateTo) {
    parts.push(
      `Pickup ${filters.dateFrom ?? "any"} to ${filters.dateTo ?? "any"}`
    );
  }
  if (filters.customerId) {
    parts.push(`Customer: ${customerName ?? filters.customerId}`);
  }
  if (filters.originCity || filters.originState) {
    parts.push(
      `Origin: ${[filters.originCity, filters.originState].filter(Boolean).join(", ")}`
    );
  }
  if (filters.destCity || filters.destState) {
    parts.push(
      `Destination: ${[filters.destCity, filters.destState].filter(Boolean).join(", ")}`
    );
  }
  if (filters.equipmentType) {
    parts.push(`Equipment: ${filters.equipmentType}`);
  }
  if (filters.commodity) {
    parts.push(`Commodity: ${filters.commodity}`);
  }

  return parts.length ? parts.join(" · ") : "All loads";
}

export async function searchLoads(
  scope: BranchScope,
  filters: LoadSearchFilters,
  pagination?: { page: number; pageSize: PageSize }
): Promise<PaginatedResult<Prisma.LoadGetPayload<{
  include: {
    customer: true;
    dispatchAssignments: { include: { carrier: true } };
    commission: true;
  };
}>>> {
  const page = pagination?.page ?? 1;
  const pageSize = pagination?.pageSize ?? DEFAULT_PAGE_SIZE;
  const where = buildLoadSearchWhere(scope, filters);
  const { skip, take } = paginationSkipTake(page, pageSize);

  const [items, total] = await Promise.all([
    prisma.load.findMany({
      where,
      orderBy: [{ pickupDate: "desc" }, { loadNumber: "desc" }],
      include: {
        customer: true,
        dispatchAssignments: {
          orderBy: { sequence: "asc" },
          include: { carrier: true }
        },
        commission: true
      },
      skip,
      take
    }),
    prisma.load.count({ where })
  ]);

  return toPaginatedResult(items, total, page, pageSize);
}

export async function getLoadSearchOptions(scope: BranchScope) {
  const [customers, commodityRows, catalogCommodities] = await Promise.all([
    prisma.customer.findMany({
      where: scope,
      orderBy: { name: "asc" },
      select: { id: true, name: true }
    }),
    prisma.load.findMany({
      where: {
        ...scope,
        commodity: { not: null }
      },
      select: { commodity: true },
      distinct: ["commodity"],
      orderBy: { commodity: "asc" }
    }),
    prisma.commodityOption.findMany({
      where: {
        companyId: scope.companyId,
        active: true
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { name: true }
    })
  ]);

  const commodities = [
    ...new Set([
      ...catalogCommodities.map((row) => row.name),
      ...commodityRows.map((row) => row.commodity).filter((value): value is string => Boolean(value))
    ])
  ].sort((a, b) => a.localeCompare(b));

  return { customers, commodities };
}

export type RevenueSummary = {
  totalRevenueCents: number;
  totalCostCents: number;
  marginCents: number;
  loadCount: number;
  avgRevenueCents: number;
  lanes: Array<{ lane: string; count: number; revenueCents: number }>;
  customers: Array<{ customer: string; count: number; revenueCents: number }>;
  loads: Array<{
    id: string;
    loadNumber: string;
    customer: string;
    pickupDate: string;
    revenueCents: number;
    costCents: number;
    marginCents: number;
    marginPercent: string;
  }>;
};

export function buildRevenueSummary(loads: SearchLoadResult[]): RevenueSummary {
  const totalRevenueCents = loads.reduce((sum, load) => sum + load.revenueCents, 0);
  const totalCostCents = loads.reduce((sum, load) => sum + load.carrierCostCents, 0);
  const marginCents = totalRevenueCents - totalCostCents;
  const loadCount = loads.length;
  const avgRevenueCents = loadCount ? Math.round(totalRevenueCents / loadCount) : 0;

  const laneMap = loads.reduce<Record<string, { count: number; revenueCents: number }>>(
    (acc, load) => {
      const lane = `${load.pickupCity}, ${load.pickupState} to ${load.deliveryCity}, ${load.deliveryState}`;
      acc[lane] = acc[lane] ?? { count: 0, revenueCents: 0 };
      acc[lane].count += 1;
      acc[lane].revenueCents += load.revenueCents;
      return acc;
    },
    {}
  );

  const customerMap = loads.reduce<Record<string, { count: number; revenueCents: number }>>(
    (acc, load) => {
      const customer = load.customer.name;
      acc[customer] = acc[customer] ?? { count: 0, revenueCents: 0 };
      acc[customer].count += 1;
      acc[customer].revenueCents += load.revenueCents;
      return acc;
    },
    {}
  );

  return {
    totalRevenueCents,
    totalCostCents,
    marginCents,
    loadCount,
    avgRevenueCents,
    lanes: Object.entries(laneMap)
      .map(([lane, summary]) => ({ lane, ...summary }))
      .sort((a, b) => b.revenueCents - a.revenueCents),
    customers: Object.entries(customerMap)
      .map(([customer, summary]) => ({ customer, ...summary }))
      .sort((a, b) => b.revenueCents - a.revenueCents),
    loads: loads.map((load) => {
      const margin = load.revenueCents - load.carrierCostCents;
      const marginPercent = load.revenueCents
        ? `${Math.round((margin / load.revenueCents) * 100)}%`
        : "0%";

      return {
        id: load.id,
        loadNumber: load.loadNumber,
        customer: load.customer.name,
        pickupDate: load.pickupDate.toISOString(),
        revenueCents: load.revenueCents,
        costCents: load.carrierCostCents,
        marginCents: margin,
        marginPercent
      };
    })
  };
}

/** Postgres-backed revenue summary — avoids loading every matching load into memory. */
export async function getRevenueSummary(
  scope: BranchScope,
  filters: LoadSearchFilters
): Promise<RevenueSummary> {
  const where = buildLoadSearchWhere(scope, filters);
  const [totals, laneGroups, customerGroups, topLoads] = await Promise.all([
    prisma.load.aggregate({
      where,
      _sum: { revenueCents: true, carrierCostCents: true },
      _count: true
    }),
    prisma.load.groupBy({
      by: ["pickupCity", "pickupState", "deliveryCity", "deliveryState"],
      where,
      _sum: { revenueCents: true },
      _count: { _all: true },
      orderBy: { _sum: { revenueCents: "desc" } },
      take: 50
    }),
    prisma.load.groupBy({
      by: ["customerId"],
      where,
      _sum: { revenueCents: true },
      _count: { _all: true },
      orderBy: { _sum: { revenueCents: "desc" } },
      take: 50
    }),
    prisma.load.findMany({
      where,
      orderBy: [{ revenueCents: "desc" }, { pickupDate: "desc" }],
      take: 50,
      include: { customer: { select: { name: true } } }
    })
  ]);

  const customers = await prisma.customer.findMany({
    where: { id: { in: customerGroups.map((row) => row.customerId) } },
    select: { id: true, name: true }
  });
  const customerNames = new Map(customers.map((row) => [row.id, row.name]));

  const totalRevenueCents = totals._sum.revenueCents ?? 0;
  const totalCostCents = totals._sum.carrierCostCents ?? 0;
  const loadCount = totals._count;
  const marginCents = totalRevenueCents - totalCostCents;

  return {
    totalRevenueCents,
    totalCostCents,
    marginCents,
    loadCount,
    avgRevenueCents: loadCount ? Math.round(totalRevenueCents / loadCount) : 0,
    lanes: laneGroups.map((row) => ({
      lane: `${row.pickupCity}, ${row.pickupState} to ${row.deliveryCity}, ${row.deliveryState}`,
      count: row._count._all,
      revenueCents: row._sum.revenueCents ?? 0
    })),
    customers: customerGroups.map((row) => ({
      customer: customerNames.get(row.customerId) ?? "Unknown",
      count: row._count._all,
      revenueCents: row._sum.revenueCents ?? 0
    })),
    loads: topLoads.map((load) => {
      const margin = load.revenueCents - load.carrierCostCents;
      return {
        id: load.id,
        loadNumber: load.loadNumber,
        customer: load.customer.name,
        pickupDate: load.pickupDate.toISOString(),
        revenueCents: load.revenueCents,
        costCents: load.carrierCostCents,
        marginCents: margin,
        marginPercent: load.revenueCents
          ? `${Math.round((margin / load.revenueCents) * 100)}%`
          : "0%"
      };
    })
  };
}

export function serializeSearchLoads(loads: SearchLoadResult[]) {
  return loads.map((load) => ({
    id: load.id,
    loadNumber: load.loadNumber,
    status: load.status,
    customer: load.customer.name,
    pickupCity: load.pickupCity,
    pickupState: load.pickupState,
    deliveryCity: load.deliveryCity,
    deliveryState: load.deliveryState,
    pickupDate: load.pickupDate.toISOString(),
    equipmentType: load.equipmentType,
    commodity: load.commodity,
    carrier: carrierDisplayName(load.dispatchAssignments),
    revenueCents: load.revenueCents,
    carrierCostCents: load.carrierCostCents,
    marginCents: load.revenueCents - load.carrierCostCents
  }));
}
