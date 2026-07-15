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

export const customerFiltersSchema = z.object({
  q: z.string().optional()
});

export type CustomerFilters = z.infer<typeof customerFiltersSchema>;

function normalizeOptional(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function parseCustomerSearchParams(searchParams: Record<string, string | string[] | undefined>) {
  const raw = {
    q: typeof searchParams.q === "string" ? searchParams.q : undefined
  };

  const parsed = customerFiltersSchema.safeParse(raw);
  return parsed.success ? parsed.data : {};
}

export function hasActiveCustomerFilters(filters: CustomerFilters) {
  return Boolean(filters.q?.trim());
}

export function buildCustomerSearchWhere(
  scope: BranchScope,
  filters: CustomerFilters
): Prisma.CustomerWhereInput {
  const where: Prisma.CustomerWhereInput = { ...scope };

  const q = normalizeOptional(filters.q);
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { city: { contains: q, mode: "insensitive" } },
      { state: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      {
        contacts: {
          some: {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } }
            ]
          }
        }
      }
    ];
  }

  return where;
}

export function buildCustomerQueryString(filters: CustomerFilters) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value?.trim()) {
      params.set(key, value.trim());
    }
  }

  return params.toString();
}

export async function searchCustomers(
  scope: BranchScope,
  filters: CustomerFilters,
  pagination?: { page: number; pageSize: PageSize }
): Promise<
  PaginatedResult<
    Prisma.CustomerGetPayload<{
      include: {
        contacts: true;
        branch: true;
        _count: { select: { loads: true } };
      };
    }> & { openArCents: number }
  >
> {
  const page = pagination?.page ?? 1;
  const pageSize = pagination?.pageSize ?? DEFAULT_PAGE_SIZE;
  const where = buildCustomerSearchWhere(scope, filters);
  const { skip, take } = paginationSkipTake(page, pageSize);

  const [rows, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        contacts: true,
        branch: true,
        _count: { select: { loads: true } }
      },
      skip,
      take
    }),
    prisma.customer.count({ where })
  ]);

  const openArByCustomer = await prisma.invoice.groupBy({
    by: ["customerId"],
    where: {
      companyId: scope.companyId,
      customerId: { in: rows.map((row) => row.id) },
      status: { notIn: ["PAID", "VOID"] }
    },
    _sum: { totalCents: true }
  });
  const openArMap = new Map(
    openArByCustomer.map((row) => [row.customerId, row._sum.totalCents ?? 0])
  );

  const items = rows.map((row) => ({
    ...row,
    openArCents: openArMap.get(row.id) ?? 0
  }));

  return toPaginatedResult(items, total, page, pageSize);
}
