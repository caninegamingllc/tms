/** Days since a delivered load became ready to invoice. */
export function daysWaitingToInvoice(deliveredAt: Date, now = new Date()): number {
  const start = Date.UTC(
    deliveredAt.getFullYear(),
    deliveredAt.getMonth(),
    deliveredAt.getDate()
  );
  const end = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.floor((end - start) / 86_400_000));
}

export type UninvoicedUrgency = "amber" | "orange" | "rose";

/** Color band from oldest waiting load (worst aging wins). */
export function uninvoicedUrgency(maxDaysWaiting: number): UninvoicedUrgency {
  if (maxDaysWaiting >= 4) return "rose";
  if (maxDaysWaiting >= 2) return "orange";
  return "amber";
}

export const uninvoicedUrgencyClass: Record<UninvoicedUrgency, string> = {
  amber: "border-amber-300/60 bg-amber-400/15 text-amber-950",
  orange: "border-orange-300/70 bg-orange-100 text-orange-950",
  rose: "border-rose-300/70 bg-rose-50 text-rose-900"
};
