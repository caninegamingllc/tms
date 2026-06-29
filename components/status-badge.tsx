import { clsx } from "clsx";
import { humanize } from "@/lib/format";

const tones: Record<string, string> = {
  QUOTE: "bg-slate-100 text-slate-700",
  AVAILABLE: "bg-blue-100 text-blue-700",
  COVERED: "bg-indigo-100 text-indigo-700",
  DISPATCHED: "bg-purple-100 text-purple-700",
  PICKED_UP: "bg-amber-100 text-amber-800",
  DELIVERED: "bg-emerald-100 text-emerald-700",
  INVOICED: "bg-cyan-100 text-cyan-700",
  PAID: "bg-green-100 text-green-700",
  CANCELED: "bg-rose-100 text-rose-700",
  OVERDUE: "bg-rose-100 text-rose-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  SENT: "bg-blue-100 text-blue-700",
  DRAFT: "bg-slate-100 text-slate-700",
  PARTIAL: "bg-amber-100 text-amber-800",
  VOID: "bg-zinc-100 text-zinc-700"
};

export function StatusBadge({ value }: { value: string }) {
  return (
    <span className={clsx("badge", tones[value] ?? "bg-slate-100 text-slate-700")}>
      {humanize(value)}
    </span>
  );
}
