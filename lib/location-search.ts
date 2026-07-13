import { z } from "zod";
import type { Prisma } from "@prisma/client";
import type { SessionUser } from "@/lib/types";
import { facilityTypes } from "@/lib/constants";
import { prisma } from "@/lib/db";

export const locationFiltersSchema = z.object({
  q: z.string().optional(),
  type: z.enum(facilityTypes).optional(),
  customerId: z.string().optional()
});

export type LocationFilters = z.infer<typeof locationFiltersSchema>;

function normalizeOptional(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function parseLocationSearchParams(searchParams: Record<string, string | string[] | undefined>) {
  const raw = {
    q: typeof searchParams.q === "string" ? searchParams.q : undefined,
    type: typeof searchParams.type === "string" ? searchParams.type : undefined,
    customerId: typeof searchParams.customerId === "string" ? searchParams.customerId : undefined
  };

  const parsed = locationFiltersSchema.safeParse(raw);
  return parsed.success ? parsed.data : {};
}

export function hasActiveLocationFilters(filters: LocationFilters) {
  return Boolean(filters.q?.trim() || filters.type?.trim() || filters.customerId?.trim());
}

export function buildLocationSearchWhere(
  user: Pick<SessionUser, "companyId">,
  filters: LocationFilters
): Prisma.FacilityWhereInput {
  const where: Prisma.FacilityWhereInput = { companyId: user.companyId };

  const type = normalizeOptional(filters.type);
  if (type) {
    where.type = type;
  }

  const customerId = normalizeOptional(filters.customerId);
  if (customerId) {
    where.customerId = customerId;
  }

  const q = normalizeOptional(filters.q);
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { city: { contains: q } },
      { state: { contains: q } },
      { address: { contains: q } },
      { postalCode: { contains: q } }
    ];
  }

  return where;
}

export function buildLocationQueryString(filters: LocationFilters) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value?.trim()) {
      params.set(key, value.trim());
    }
  }

  return params.toString();
}

export async function searchLocations(
  user: Pick<SessionUser, "companyId">,
  filters: LocationFilters
) {
  return prisma.facility.findMany({
    where: buildLocationSearchWhere(user, filters),
    orderBy: [{ name: "asc" }, { city: "asc" }],
    include: { customer: true, loadStops: true }
  });
}
