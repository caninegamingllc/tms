import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { commissionStatuses } from "@/lib/constants";

export const commissionFiltersSchema = z.object({
  status: z.enum(commissionStatuses).optional(),
  commissionable: z.enum(["yes", "no"]).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional()
});

export type CommissionFilters = z.infer<typeof commissionFiltersSchema>;

export function parseCommissionSearchParams(searchParams: Record<string, string | string[] | undefined>) {
  const raw = {
    status:
      typeof searchParams.status === "string" && searchParams.status
        ? searchParams.status
        : undefined,
    commissionable:
      typeof searchParams.commissionable === "string" && searchParams.commissionable
        ? searchParams.commissionable
        : undefined,
    dateFrom: typeof searchParams.dateFrom === "string" && searchParams.dateFrom ? searchParams.dateFrom : undefined,
    dateTo: typeof searchParams.dateTo === "string" && searchParams.dateTo ? searchParams.dateTo : undefined
  };

  return commissionFiltersSchema.parse(raw);
}

export function buildCommissionWhere(
  loadScope: Prisma.LoadWhereInput,
  filters: CommissionFilters
): Prisma.LoadCommissionWhereInput {
  const where: Prisma.LoadCommissionWhereInput = {
    load: loadScope
  };

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.commissionable === "yes") {
    where.isCommissionable = true;
  } else if (filters.commissionable === "no") {
    where.isCommissionable = false;
  }

  if (filters.dateFrom || filters.dateTo) {
    where.load = {
      ...loadScope,
      pickupDate: {
        ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
        ...(filters.dateTo ? { lte: new Date(`${filters.dateTo}T23:59:59`) } : {})
      }
    };
  }

  return where;
}

export function buildCommissionQueryString(filters: CommissionFilters) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      params.set(key, value);
    }
  }

  return params.toString();
}
