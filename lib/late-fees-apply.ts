import "server-only";

import { prisma } from "@/lib/db";
import { LATE_FEE_CHARGE_TYPE, lateFeeLabel, lateFeesToApply } from "@/lib/late-fees";

/**
 * Apply stacked late fees for an overdue invoice email send.
 * Returns how many cents were added (0 if none).
 */
export async function applyLateFeesForInvoiceSend(input: {
  loadId: string;
  invoiceId: string;
  asOf?: Date;
}): Promise<{ addedCents: number; feesApplied: number }> {
  const load = await prisma.load.findUniqueOrThrow({
    where: { id: input.loadId },
    include: {
      charges: true,
      customer: { select: { paymentTerms: true, lateFeePercent: true } },
      invoices: { where: { id: input.invoiceId }, take: 1 }
    }
  });

  const invoice = load.invoices[0];
  if (!invoice) {
    return { addedCents: 0, feesApplied: 0 };
  }

  const plan = lateFeesToApply({
    dueAt: invoice.dueAt,
    paymentTerms: load.customer.paymentTerms,
    lateFeePercent: load.customer.lateFeePercent,
    balanceCents: invoice.balanceCents,
    status: invoice.status,
    charges: load.charges,
    asOf: input.asOf
  });

  if (plan.feesToApply <= 0 || plan.totalAddCents <= 0) {
    return { addedCents: 0, feesApplied: 0 };
  }

  const chargeCreates = Array.from({ length: plan.feesToApply }, (_, index) => ({
    loadId: load.id,
    label: lateFeeLabel(plan.existingCount + index + 1),
    chargeType: LATE_FEE_CHARGE_TYPE,
    amountCents: plan.feeAmountCents
  }));

  await prisma.$transaction(async (tx) => {
    await tx.loadCharge.createMany({ data: chargeCreates });
    await tx.load.update({
      where: { id: load.id },
      data: { revenueCents: { increment: plan.totalAddCents } }
    });
    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        totalCents: { increment: plan.totalAddCents },
        balanceCents: { increment: plan.totalAddCents }
      }
    });
  });

  return { addedCents: plan.totalAddCents, feesApplied: plan.feesToApply };
}
