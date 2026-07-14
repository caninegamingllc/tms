import { clsx } from "clsx";
import { humanize } from "@/lib/format";

const tones: Record<string, string> = {
  QUOTE: "border-slate-200 bg-slate-100 text-slate-700",
  AVAILABLE: "border-sky-200 bg-sky-50 text-sky-700",
  COVERED: "border-indigo-200 bg-indigo-50 text-indigo-700",
  DISPATCHED: "border-cyan-200 bg-cyan-50 text-cyan-800",
  PICKED_UP: "border-amber-200 bg-amber-50 text-amber-800",
  DELIVERED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  INVOICED: "border-teal-200 bg-teal-50 text-teal-700",
  PAID: "border-green-200 bg-green-50 text-green-700",
  CANCELED: "border-rose-200 bg-rose-50 text-rose-700",
  OVERDUE: "border-rose-200 bg-rose-50 text-rose-700",
  APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  SENT: "border-sky-200 bg-sky-50 text-sky-700",
  DRAFT: "border-slate-200 bg-slate-100 text-slate-700",
  PARTIAL: "border-amber-200 bg-amber-50 text-amber-800",
  VOID: "border-zinc-200 bg-zinc-100 text-zinc-700",
  PENDING: "border-amber-200 bg-amber-50 text-amber-800",
  PAYABLE: "border-sky-200 bg-sky-50 text-sky-700",
  SETTLED: "border-green-200 bg-green-50 text-green-700",
  INELIGIBLE: "border-zinc-200 bg-zinc-100 text-zinc-700"
};

export function StatusBadge({ value }: { value: string }) {
  return (
    <span className={clsx("badge", tones[value] ?? "border-slate-200 bg-slate-100 text-slate-700")}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {humanize(value)}
    </span>
  );
}
