import { z } from "zod";
import type { Prisma } from "@prisma/client";
import type { SessionUser } from "@/lib/types";
import { branchScopedWhere } from "@/lib/scope";
import { prisma } from "@/lib/db";

export const customerFiltersSchema = z.object({
  q: z.string().optional(),
  branchId: z.string().optional()
});

export type CustomerFilters = z.infer<typeof customerFiltersSchema>;

function normalizeOptional(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function parseCustomerSearchParams(searchParams: Record<string, string | string[] | undefined>) {
  const raw = {
    q: typeof searchParams.q === "string" ? searchParams.q : undefined,
    branchId: typeof searchParams.branchId === "string" ? searchParams.branchId : undefined
  };

  const parsed = customerFiltersSchema.safeParse(raw);
  return parsed.success ? parsed.data : {};
}

export function hasActiveCustomerFilters(filters: CustomerFilters) {
  return Boolean(filters.q?.trim() || filters.branchId?.trim());
}

export function buildCustomerSearchWhere(
  user: Pick<SessionUser, "companyId" | "role" | "branchId">,
  filters: CustomerFilters
): Prisma.CustomerWhereInput {
  const where: Prisma.CustomerWhereInput = { ...branchScopedWhere(user) };

  const branchId = normalizeOptional(filters.branchId);
  if (branchId) {
    where.branchId = branchId;
  }

  const q = normalizeOptional(filters.q);
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { city: { contains: q } },
      { state: { contains: q } },
      { email: { contains: q } },
      { contacts: { some: { OR: [{ name: { contains: q } }, { email: { contains: q } }] } } }
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
  user: Pick<SessionUser, "companyId" | "role" | "branchId">,
  filters: CustomerFilters
) {
  return prisma.customer.findMany({
    where: buildCustomerSearchWhere(user, filters),
    orderBy: { name: "asc" },
    include: {
      contacts: true,
      loads: true,
      invoices: true,
      branch: true
    }
  });
}
