"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/auth";
import { assertPlanFeature, requireWriteUser } from "@/lib/permissions";
import { canAccessRecord } from "@/lib/branch-filter-server";
import { canSettleCommission } from "@/lib/scope";
import { parseMoneyToCents } from "@/lib/format";
import { ensureDefaultCommissionProfile, recalculateLoadCommission } from "@/lib/commission";

function requiredString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) {
    throw new Error(`${key} is required`);
  }
  return value;
}

function optionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || undefined;
}

async function requireCommissionLoad(loadId: string, user: Awaited<ReturnType<typeof requireWriteUser>>) {
  const load = await prisma.load.findUniqueOrThrow({
    where: { id: loadId, companyId: user.companyId }
  });

  if (!(await canAccessRecord(user, load.branchId))) {
    throw new Error("Load not found.");
  }

  return load;
}

export async function markInvoicePaid(formData: FormData) {
  const user = await requireWriteUser();
  const invoiceId = requiredString(formData, "invoiceId");
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId, companyId: user.companyId },
    include: { load: true }
  });

  if (!(await canAccessRecord(user, invoice.load.branchId))) {
    throw new Error("Invoice not found.");
  }

  const { applyFullInvoicePayment } = await import("@/lib/accounting-actions");
  await applyFullInvoicePayment({
    companyId: user.companyId,
    userId: user.id,
    invoiceId
  });

  revalidatePath("/accounting");
  revalidatePath("/commissions");
  revalidatePath("/loads");
  revalidatePath(`/loads/${invoice.loadId}`);
}

export async function updateLoadCommissionable(formData: FormData) {
  const user = await requireWriteUser();
  const loadId = requiredString(formData, "loadId");
  const isCommissionable = formData.get("isCommissionable") === "on" || formData.get("isCommissionable") === "true";
  await requireCommissionLoad(loadId, user);

  await prisma.load.update({
    where: { id: loadId },
    data: { isCommissionable }
  });

  await recalculateLoadCommission(loadId);

  revalidatePath("/commissions");
  revalidatePath("/loads");
  revalidatePath(`/loads/${loadId}`);
}

export async function addLoadExpense(formData: FormData) {
  const user = await requireWriteUser();
  const loadId = requiredString(formData, "loadId");
  await requireCommissionLoad(loadId, user);

  await prisma.loadExpense.create({
    data: {
      loadId,
      label: requiredString(formData, "label"),
      expenseType: requiredString(formData, "expenseType"),
      amountCents: parseMoneyToCents(formData.get("amount"))
    }
  });

  await recalculateLoadCommission(loadId);

  revalidatePath("/commissions");
  revalidatePath("/loads");
  revalidatePath(`/loads/${loadId}`);
}

export async function removeLoadExpense(formData: FormData) {
  const user = await requireWriteUser();
  const expenseId = requiredString(formData, "expenseId");
  const loadId = requiredString(formData, "loadId");
  await requireCommissionLoad(loadId, user);

  await prisma.loadExpense.delete({ where: { id: expenseId, loadId } });
  await recalculateLoadCommission(loadId);

  revalidatePath("/commissions");
  revalidatePath("/loads");
  revalidatePath(`/loads/${loadId}`);
}

export async function assignLoadCommissionProfile(formData: FormData) {
  const user = await requireAdmin();
  const loadId = requiredString(formData, "loadId");
  const profileId = optionalString(formData, "profileId");
  await requireCommissionLoad(loadId, user);

  if (profileId) {
    await prisma.commissionProfile.findUniqueOrThrow({
      where: { id: profileId, companyId: user.companyId }
    });
  }

  await prisma.load.update({
    where: { id: loadId },
    data: { commissionProfileId: profileId ?? null }
  });

  await recalculateLoadCommission(loadId);

  revalidatePath("/commissions");
  revalidatePath("/loads");
  revalidatePath(`/loads/${loadId}`);
}

export async function settleBranchCommission(formData: FormData) {
  const user = await requireUser();

  if (!canSettleCommission(user)) {
    throw new Error("You do not have permission to settle commissions.");
  }

  const commissionIds = formData.getAll("commissionIds").map(String).filter(Boolean);
  if (!commissionIds.length) {
    throw new Error("No commissions selected.");
  }

  const commissions = await prisma.loadCommission.findMany({
    where: {
      id: { in: commissionIds },
      status: "PAYABLE",
      load: { companyId: user.companyId }
    },
    include: { load: true }
  });

  for (const commission of commissions) {
    if (!(await canAccessRecord(user, commission.load.branchId))) {
      continue;
    }

    await prisma.loadCommission.update({
      where: { id: commission.id },
      data: {
        status: "SETTLED",
        settledAt: new Date(),
        settledByUserId: user.id
      }
    });
  }

  revalidatePath("/commissions");
  revalidatePath("/loads");
}

export async function settleLoadCommission(formData: FormData) {
  const user = await requireUser();
  await assertPlanFeature(user.companyId, "commissions");

  if (!canSettleCommission(user)) {
    throw new Error("You do not have permission to settle commissions.");
  }

  const loadId = requiredString(formData, "loadId");
  const commission = await prisma.loadCommission.findUnique({
    where: { loadId },
    include: { load: true }
  });

  if (!commission || commission.load.companyId !== user.companyId || commission.status !== "PAYABLE") {
    throw new Error("Commission not found or not payable.");
  }

  if (!(await canAccessRecord(user, commission.load.branchId))) {
    throw new Error("Commission not found.");
  }

  await prisma.loadCommission.update({
    where: { id: commission.id },
    data: {
      status: "SETTLED",
      settledAt: new Date(),
      settledByUserId: user.id
    }
  });

  revalidatePath("/commissions");
  revalidatePath("/loads");
  revalidatePath(`/loads/${loadId}`);
}

export async function createCommissionProfile(formData: FormData) {
  const user = await requireAdmin();
  await assertPlanFeature(user.companyId, "commissions");
  const name = requiredString(formData, "name");
  const branchSharePercent = Number(formData.get("branchSharePercent") ?? 60);
  const companySharePercent = Number(formData.get("companySharePercent") ?? 40);
  const companyMinimumExpensePercent = Number(formData.get("companyMinimumExpensePercent") ?? 10);
  const isDefault = formData.get("isDefault") === "on";

  if (isDefault) {
    await prisma.commissionProfile.updateMany({
      where: { companyId: user.companyId, isDefault: true },
      data: { isDefault: false }
    });
  }

  await prisma.commissionProfile.create({
    data: {
      companyId: user.companyId,
      name,
      isDefault,
      rule: {
        create: {
          branchSharePercent,
          companySharePercent,
          companyMinimumExpensePercent
        }
      }
    }
  });

  revalidatePath("/commissions/profiles");
  revalidatePath("/commissions");
}

export async function updateCommissionProfile(formData: FormData) {
  const user = await requireAdmin();
  await assertPlanFeature(user.companyId, "commissions");
  const profileId = requiredString(formData, "profileId");
  const name = requiredString(formData, "name");
  const branchSharePercent = Number(formData.get("branchSharePercent") ?? 60);
  const companySharePercent = Number(formData.get("companySharePercent") ?? 40);
  const companyMinimumExpensePercent = Number(formData.get("companyMinimumExpensePercent") ?? 10);
  const isDefault = formData.get("isDefault") === "on";

  await prisma.commissionProfile.findUniqueOrThrow({
    where: { id: profileId, companyId: user.companyId }
  });

  if (isDefault) {
    await prisma.commissionProfile.updateMany({
      where: { companyId: user.companyId, isDefault: true, id: { not: profileId } },
      data: { isDefault: false }
    });
  }

  await prisma.commissionProfile.update({
    where: { id: profileId },
    data: {
      name,
      isDefault,
      rule: {
        upsert: {
          create: { branchSharePercent, companySharePercent, companyMinimumExpensePercent },
          update: { branchSharePercent, companySharePercent, companyMinimumExpensePercent }
        }
      }
    }
  });

  revalidatePath("/commissions/profiles");
  revalidatePath("/commissions");
}

export async function assignBranchCommissionProfile(formData: FormData) {
  const user = await requireAdmin();
  const branchId = requiredString(formData, "branchId");
  const profileId = optionalString(formData, "profileId");

  await prisma.branch.findUniqueOrThrow({
    where: { id: branchId, companyId: user.companyId }
  });

  if (profileId) {
    await prisma.commissionProfile.findUniqueOrThrow({
      where: { id: profileId, companyId: user.companyId }
    });
  }

  await prisma.branch.update({
    where: { id: branchId },
    data: { commissionProfileId: profileId ?? null }
  });

  revalidatePath("/commissions/profiles");
  revalidatePath("/commissions");
  revalidatePath("/admin");
}

export async function ensureCompanyCommissionProfile(companyId: string) {
  return ensureDefaultCommissionProfile(companyId);
}
