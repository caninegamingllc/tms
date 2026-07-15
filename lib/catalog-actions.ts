"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { carrierPayCalculationMethods } from "@/lib/constants";
import { ensureCompanyCatalogs } from "@/lib/catalogs";

function requiredString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) {
    throw new Error(`${key} is required`);
  }
  return value;
}

function parseSortOrder(formData: FormData) {
  const raw = Number(formData.get("sortOrder") ?? 0);
  return Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
}

function parseCalculationMethod(formData: FormData) {
  const value = String(formData.get("calculationMethod") ?? "FLAT").trim();
  if (!(carrierPayCalculationMethods as readonly string[]).includes(value)) {
    throw new Error("Invalid calculation method.");
  }
  return value;
}

function revalidateAdminCatalogs() {
  revalidatePath("/admin");
  revalidatePath("/loads");
  revalidatePath("/loads/new");
}

export async function createCommodityOption(formData: FormData) {
  const user = await requireAdmin();
  await ensureCompanyCatalogs(user.companyId);

  const name = requiredString(formData, "name");
  const sortOrder = parseSortOrder(formData);

  await prisma.commodityOption.create({
    data: {
      companyId: user.companyId,
      name,
      sortOrder,
      active: true
    }
  });

  revalidateAdminCatalogs();
}

export async function updateCommodityOption(formData: FormData) {
  const user = await requireAdmin();
  const id = requiredString(formData, "id");
  const name = requiredString(formData, "name");
  const sortOrder = parseSortOrder(formData);
  const active = formData.get("active") === "on" || formData.get("active") === "true";

  const existing = await prisma.commodityOption.findFirst({
    where: { id, companyId: user.companyId }
  });
  if (!existing) {
    throw new Error("Commodity not found.");
  }

  await prisma.commodityOption.update({
    where: { id },
    data: { name, sortOrder, active }
  });

  revalidateAdminCatalogs();
}

export async function deleteCommodityOption(formData: FormData) {
  const user = await requireAdmin();
  const id = requiredString(formData, "id");

  const existing = await prisma.commodityOption.findFirst({
    where: { id, companyId: user.companyId }
  });
  if (!existing) {
    throw new Error("Commodity not found.");
  }

  await prisma.commodityOption.delete({ where: { id } });
  revalidateAdminCatalogs();
}

export async function createCarrierPayLineType(formData: FormData) {
  const user = await requireAdmin();
  await ensureCompanyCatalogs(user.companyId);

  const name = requiredString(formData, "name");
  const calculationMethod = parseCalculationMethod(formData);
  const sortOrder = parseSortOrder(formData);

  await prisma.carrierPayLineType.create({
    data: {
      companyId: user.companyId,
      name,
      calculationMethod,
      sortOrder,
      active: true,
      isSystem: false
    }
  });

  revalidateAdminCatalogs();
}

export async function updateCarrierPayLineType(formData: FormData) {
  const user = await requireAdmin();
  const id = requiredString(formData, "id");
  const name = requiredString(formData, "name");
  const calculationMethod = parseCalculationMethod(formData);
  const sortOrder = parseSortOrder(formData);
  const active = formData.get("active") === "on" || formData.get("active") === "true";

  const existing = await prisma.carrierPayLineType.findFirst({
    where: { id, companyId: user.companyId }
  });
  if (!existing) {
    throw new Error("Pay line type not found.");
  }

  await prisma.carrierPayLineType.update({
    where: { id },
    data: {
      name,
      calculationMethod,
      sortOrder,
      active
    }
  });

  revalidateAdminCatalogs();
}

export async function deleteCarrierPayLineType(formData: FormData) {
  const user = await requireAdmin();
  const id = requiredString(formData, "id");

  const existing = await prisma.carrierPayLineType.findFirst({
    where: { id, companyId: user.companyId },
    include: { _count: { select: { payLines: true } } }
  });
  if (!existing) {
    throw new Error("Pay line type not found.");
  }

  if (existing.isSystem) {
    throw new Error("System pay line types cannot be deleted. Deactivate them instead.");
  }

  if (existing._count.payLines > 0) {
    throw new Error("This pay line type is in use. Deactivate it instead of deleting.");
  }

  await prisma.carrierPayLineType.delete({ where: { id } });
  revalidateAdminCatalogs();
}

export async function toggleCommodityActive(formData: FormData) {
  const user = await requireAdmin();
  const id = requiredString(formData, "id");
  const existing = await prisma.commodityOption.findFirst({
    where: { id, companyId: user.companyId }
  });
  if (!existing) {
    throw new Error("Commodity not found.");
  }

  await prisma.commodityOption.update({
    where: { id },
    data: { active: !existing.active }
  });

  revalidateAdminCatalogs();
}

export async function toggleCarrierPayLineTypeActive(formData: FormData) {
  const user = await requireAdmin();
  const id = requiredString(formData, "id");
  const existing = await prisma.carrierPayLineType.findFirst({
    where: { id, companyId: user.companyId }
  });
  if (!existing) {
    throw new Error("Pay line type not found.");
  }

  await prisma.carrierPayLineType.update({
    where: { id },
    data: { active: !existing.active }
  });

  revalidateAdminCatalogs();
}

export async function createCustomerChargeType(formData: FormData) {
  const user = await requireAdmin();
  await ensureCompanyCatalogs(user.companyId);

  const name = requiredString(formData, "name");
  const calculationMethod = parseCalculationMethod(formData);
  const sortOrder = parseSortOrder(formData);

  await prisma.customerChargeType.create({
    data: {
      companyId: user.companyId,
      name,
      calculationMethod,
      sortOrder,
      active: true,
      isSystem: false
    }
  });

  revalidateAdminCatalogs();
}

export async function updateCustomerChargeType(formData: FormData) {
  const user = await requireAdmin();
  const id = requiredString(formData, "id");
  const name = requiredString(formData, "name");
  const calculationMethod = parseCalculationMethod(formData);
  const sortOrder = parseSortOrder(formData);
  const active = formData.get("active") === "on" || formData.get("active") === "true";

  const existing = await prisma.customerChargeType.findFirst({
    where: { id, companyId: user.companyId }
  });
  if (!existing) {
    throw new Error("Charge type not found.");
  }

  await prisma.customerChargeType.update({
    where: { id },
    data: {
      name,
      calculationMethod,
      sortOrder,
      active
    }
  });

  revalidateAdminCatalogs();
}

export async function deleteCustomerChargeType(formData: FormData) {
  const user = await requireAdmin();
  const id = requiredString(formData, "id");

  const existing = await prisma.customerChargeType.findFirst({
    where: { id, companyId: user.companyId },
    include: { _count: { select: { charges: true } } }
  });
  if (!existing) {
    throw new Error("Charge type not found.");
  }

  if (existing.isSystem) {
    throw new Error("System charge types cannot be deleted. Deactivate them instead.");
  }

  if (existing._count.charges > 0) {
    throw new Error("This charge type is in use. Deactivate it instead of deleting.");
  }

  await prisma.customerChargeType.delete({ where: { id } });
  revalidateAdminCatalogs();
}

export async function toggleCustomerChargeTypeActive(formData: FormData) {
  const user = await requireAdmin();
  const id = requiredString(formData, "id");
  const existing = await prisma.customerChargeType.findFirst({
    where: { id, companyId: user.companyId }
  });
  if (!existing) {
    throw new Error("Charge type not found.");
  }

  await prisma.customerChargeType.update({
    where: { id },
    data: { active: !existing.active }
  });

  revalidateAdminCatalogs();
}
