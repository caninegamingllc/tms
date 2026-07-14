export type AgingBucketKey = "current" | "past0to29" | "past30" | "past45" | "past60";

export type AgingBucketAmounts = Record<AgingBucketKey, number>;

export const AGING_BUCKET_LABELS: Record<AgingBucketKey, string> = {
  current: "Current",
  past0to29: "0-29 Days Past Due",
  past30: "30+ Days Past Due",
  past45: "45+ Days Past Due",
  past60: "60+ Days Past Due"
};

export function emptyAgingBuckets(): AgingBucketAmounts {
  return {
    current: 0,
    past0to29: 0,
    past30: 0,
    past45: 0,
    past60: 0
  };
}

/** Days past due from due date to asOf (0 if not yet due). */
export function daysPastDue(dueAt: Date | string | null | undefined, asOf: Date = new Date()): number {
  if (!dueAt) {
    return 0;
  }

  const due = new Date(dueAt);
  const dueDay = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  const asOfDay = Date.UTC(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
  const diff = Math.floor((asOfDay - dueDay) / 86_400_000);
  return Math.max(0, diff);
}

export function agingBucketForDaysPastDue(days: number): AgingBucketKey {
  if (days <= 0) {
    return "current";
  }
  if (days < 30) {
    return "past0to29";
  }
  if (days < 45) {
    return "past30";
  }
  if (days < 60) {
    return "past45";
  }
  return "past60";
}

/** Put remaining balance into exactly one aging bucket (Ascend-style). */
export function bucketBalance(
  balanceCents: number,
  dueAt: Date | string | null | undefined,
  asOf: Date = new Date()
): AgingBucketAmounts {
  const buckets = emptyAgingBuckets();
  if (balanceCents <= 0) {
    return buckets;
  }

  const days = daysPastDue(dueAt, asOf);
  const key = agingBucketForDaysPastDue(days);
  buckets[key] = balanceCents;
  return buckets;
}

export function sumAgingBuckets(rows: AgingBucketAmounts[]): AgingBucketAmounts {
  return rows.reduce((acc, row) => {
    acc.current += row.current;
    acc.past0to29 += row.past0to29;
    acc.past30 += row.past30;
    acc.past45 += row.past45;
    acc.past60 += row.past60;
    return acc;
  }, emptyAgingBuckets());
}

/** Parse "Net 30", "NET30", "30", "Due on Receipt" → days until due. */
export function parsePaymentTermsDays(terms: string | null | undefined): number {
  if (!terms) {
    return 30;
  }

  const normalized = terms.trim().toLowerCase();
  if (!normalized || normalized.includes("receipt") || normalized.includes("cod")) {
    return 0;
  }

  const match = normalized.match(/(\d+)/);
  if (!match) {
    return 30;
  }

  return Number(match[1]);
}

export function dueDateFromTerms(issuedAt: Date, paymentTerms: string | null | undefined): Date {
  const due = new Date(issuedAt);
  due.setDate(due.getDate() + parsePaymentTermsDays(paymentTerms));
  return due;
}

export function statusFromBalance(input: {
  balanceCents: number;
  totalCents: number;
  dueAt: Date | string | null | undefined;
  currentStatus: string;
  asOf?: Date;
}): string {
  if (input.currentStatus === "VOID") {
    return "VOID";
  }

  if (input.balanceCents <= 0) {
    return "PAID";
  }

  if (input.balanceCents < input.totalCents) {
    return "PARTIAL";
  }

  const days = daysPastDue(input.dueAt, input.asOf);
  if (days > 0) {
    return "OVERDUE";
  }

  if (input.currentStatus === "DRAFT" || input.currentStatus === "SENT" || input.currentStatus === "APPROVED") {
    return input.currentStatus;
  }

  return input.currentStatus === "OVERDUE" || input.currentStatus === "PARTIAL" || input.currentStatus === "PAID"
    ? "SENT"
    : input.currentStatus;
}
