import { z } from "zod";
import type { Prisma } from "@prisma/client";
import type { SessionUser } from "@/lib/types";
import { prisma } from "@/lib/db";

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
  user: Pick<SessionUser, "companyId">,
  filters: CarrierFilters
): Prisma.CarrierWhereInput {
  const where: Prisma.CarrierWhereInput = { companyId: user.companyId };

  const complianceStatus = normalizeOptional(filters.complianceStatus);
  if (complianceStatus) {
    where.complianceStatus = complianceStatus;
  }

  const equipmentType = normalizeOptional(filters.equipmentType);
  if (equipmentType) {
    where.equipmentTypes = { contains: equipmentType };
  }

  const q = normalizeOptional(filters.q);
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { mcNumber: { contains: q } },
      { dotNumber: { contains: q } },
      { email: { contains: q } },
      { phone: { contains: q } }
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
  user: Pick<SessionUser, "companyId">,
  filters: CarrierFilters
) {
  return prisma.carrier.findMany({
    where: buildCarrierSearchWhere(user, filters),
    orderBy: { name: "asc" },
    include: {
      contacts: true,
      complianceDocuments: true,
      insuranceCoverages: true,
      assignments: { include: { load: true } }
    }
  });
}
