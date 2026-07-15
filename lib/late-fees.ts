import { daysPastDue, parsePaymentTermsDays } from "@/lib/accounting-aging";

export const LATE_FEE_CHARGE_TYPE = "Late Fee";

export type LateFeeChargeLike = {
  chargeType: string;
  amountCents: number;
};

export function isLateFeeCharge(charge: LateFeeChargeLike): boolean {
  return charge.chargeType === LATE_FEE_CHARGE_TYPE;
}

export function countAppliedLateFees(charges: LateFeeChargeLike[]): number {
  return charges.filter(isLateFeeCharge).length;
}

/** Original invoice base = non–late-fee charge total. */
export function lateFeeBaseCents(charges: LateFeeChargeLike[]): number {
  return charges.reduce((sum, charge) => (isLateFeeCharge(charge) ? sum : sum + charge.amountCents), 0);
}

export function lateFeeAmountCents(baseCents: number, lateFeePercent: number): number {
  if (!(lateFeePercent > 0) || baseCents <= 0) {
    return 0;
  }
  return Math.round((baseCents * lateFeePercent) / 100);
}

/**
 * How many terms periods are fully past due.
 * termsDays of 0 ("due on receipt") is treated as 1-day periods after the due date.
 */
export function overdueLateFeePeriods(
  dueAt: Date | string | null | undefined,
  paymentTerms: string | null | undefined,
  asOf: Date = new Date()
): number {
  const days = daysPastDue(dueAt, asOf);
  if (days <= 0) {
    return 0;
  }
  const termsDays = Math.max(1, parsePaymentTermsDays(paymentTerms));
  return Math.floor(days / termsDays);
}

export function lateFeesToApply(input: {
  dueAt: Date | string | null | undefined;
  paymentTerms: string | null | undefined;
  lateFeePercent: number;
  balanceCents: number;
  status: string;
  charges: LateFeeChargeLike[];
  asOf?: Date;
}): { periodsDue: number; existingCount: number; feesToApply: number; feeAmountCents: number; totalAddCents: number } {
  const existingCount = countAppliedLateFees(input.charges);
  const empty = { periodsDue: 0, existingCount, feesToApply: 0, feeAmountCents: 0, totalAddCents: 0 };

  if (!(input.lateFeePercent > 0)) {
    return empty;
  }
  if (input.balanceCents <= 0 || input.status === "PAID" || input.status === "VOID") {
    return empty;
  }

  const periodsDue = overdueLateFeePeriods(input.dueAt, input.paymentTerms, input.asOf);
  const feesToApply = Math.max(0, periodsDue - existingCount);
  if (feesToApply <= 0) {
    return { periodsDue, existingCount, feesToApply: 0, feeAmountCents: 0, totalAddCents: 0 };
  }

  const feeAmountCents = lateFeeAmountCents(lateFeeBaseCents(input.charges), input.lateFeePercent);
  if (feeAmountCents <= 0) {
    return { periodsDue, existingCount, feesToApply: 0, feeAmountCents: 0, totalAddCents: 0 };
  }

  return {
    periodsDue,
    existingCount,
    feesToApply,
    feeAmountCents,
    totalAddCents: feeAmountCents * feesToApply
  };
}

export function lateFeeLabel(sequenceNumber: number): string {
  return sequenceNumber <= 1 ? LATE_FEE_CHARGE_TYPE : `${LATE_FEE_CHARGE_TYPE} (${sequenceNumber})`;
}

export function parseLateFeePercent(value: FormDataEntryValue | null | undefined): number {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return 0;
  }
  const numeric = Number(raw.replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }
  // Cap at a sane maximum to avoid form accidents.
  return Math.min(100, Math.round(numeric * 100) / 100);
}

export function formatLateFeePercent(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n === 0) {
    return "0%";
  }
  const rounded = Math.round(n * 100) / 100;
  return `${rounded}%`;
}
