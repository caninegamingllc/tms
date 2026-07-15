import { z } from "zod";
import type { Prisma } from "@prisma/client";
import type { BranchScope } from "@/lib/scope";
import { prisma } from "@/lib/db";
import {
  DEFAULT_PAGE_SIZE,
  paginationSkipTake,
  toPaginatedResult,
  type PageSize,
  type PaginatedResult
} from "@/lib/pagination";

export const carrierFiltersSchema = z.object({
  q: z.string().optional(),
  complianceStatus: z.string().optional(),
  equipmentType: z.string().optional()
});

export type CarrierFilters = z.infer<typeof carrierFiltersSchema>;

function normalizeOptional(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function parseCarrierSearchParams(searchParams: Record<string, string | string[] | undefined>) {
  const raw = {
    q: typeof searchParams.q === "string" ? searchParams.q : undefined,
    complianceStatus: typeof searchParams.complianceStatus === "string" ? searchParams.complianceStatus : undefined,
    equipmentType: typeof searchParams.equipmentType === "string" ? searchParams.equipmentType : undefined
  };

  const parsed = carrierFiltersSchema.safeParse(raw);
  return parsed.success ? parsed.data : {};
}

export function hasActiveCarrierFilters(filters: CarrierFilters) {
  return Boolean(filters.q?.trim() || filters.complianceStatus?.trim() || filters.equipmentType?.trim());
}

export function buildCarrierSearchWhere(
  scope: BranchScope,
  filters: CarrierFilters
): Prisma.CarrierWhereInput {
  const where: Prisma.CarrierWhereInput = { ...scope };

  const complianceStatus = normalizeOptional(filters.complianceStatus);
  if (complianceStatus) {
    where.complianceStatus = complianceStatus;
  }

  const equipmentType = normalizeOptional(filters.equipmentType);
  if (equipmentType) {
    where.equipmentTypes = { contains: equipmentType, mode: "insensitive" };
  }

  const q = normalizeOptional(filters.q);
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { mcNumber: { contains: q, mode: "insensitive" } },
      { dotNumber: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } }
    ];
  }

  return where;
}

export function buildCarrierQueryString(filters: CarrierFilters) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value?.trim()) {
      params.set(key, value.trim());
    }
  }

  return params.toString();
}

export async function searchCarriers(
  scope: BranchScope,
  filters: CarrierFilters,
  pagination?: { page: number; pageSize: PageSize }
): Promise<
  PaginatedResult<
    Prisma.CarrierGetPayload<{
      include: {
        contacts: true;
        insuranceCoverages: true;
        _count: { select: { assignments: true; complianceDocuments: true } };
      };
    }> & { totalSpendCents: number }
  >
> {
  const page = pagination?.page ?? 1;
  const pageSize = pagination?.pageSize ?? DEFAULT_PAGE_SIZE;
  const where = buildCarrierSearchWhere(scope, filters);
  const { skip, take } = paginationSkipTake(page, pageSize);

  const [rows, total] = await Promise.all([
    prisma.carrier.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        contacts: true,
        insuranceCoverages: true,
        _count: { select: { assignments: true, complianceDocuments: true } }
      },
      skip,
      take
    }),
    prisma.carrier.count({ where })
  ]);

  const spend = await prisma.dispatchAssignment.groupBy({
    by: ["carrierId"],
    where: { carrierId: { in: rows.map((row) => row.id) } },
    _sum: { rateCents: true }
  });
  const spendMap = new Map(spend.map((row) => [row.carrierId, row._sum.rateCents ?? 0]));

  const items = rows.map((row) => ({
    ...row,
    totalSpendCents: spendMap.get(row.id) ?? 0
  }));

  return toPaginatedResult(items, total, page, pageSize);
}
