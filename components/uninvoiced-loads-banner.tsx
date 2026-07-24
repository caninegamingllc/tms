import Link from "next/link";
import {
  daysWaitingToInvoice,
  uninvoicedUrgency,
  uninvoicedUrgencyClass
} from "@/lib/uninvoiced-alert";

export type UninvoicedLoadRow = {
  id: string;
  loadNumber: string;
  customerName: string;
  deliveredAt: Date;
};

export function UninvoicedLoadsBanner({ loads }: { loads: UninvoicedLoadRow[] }) {
  if (loads.length === 0) {
    return null;
  }

  const withDays = loads.map((load) => ({
    ...load,
    daysWaiting: daysWaitingToInvoice(load.deliveredAt)
  }));
  const maxDays = Math.max(...withDays.map((row) => row.daysWaiting));
  const urgency = uninvoicedUrgency(maxDays);
  const preview = withDays.slice(0, 4);
  const remaining = withDays.length - preview.length;

  return (
    <div className={`card mb-6 w-full border sm:w-1/2 ${uninvoicedUrgencyClass[urgency]}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">
            {loads.length === 1
              ? "1 load waiting to invoice"
              : `${loads.length} loads waiting to invoice`}
            {maxDays > 0 ? (
              <span className="font-normal opacity-80">
                {" "}
                · oldest {maxDays} day{maxDays === 1 ? "" : "s"}
              </span>
            ) : (
              <span className="font-normal opacity-80"> · delivered today</span>
            )}
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {preview.map((row) => (
              <li key={row.id}>
                <Link href={`/loads/${row.id}`} className="font-semibold underline-offset-2 hover:underline">
                  {row.loadNumber}
                </Link>
                <span className="opacity-80">
                  {" "}
                  · {row.customerName} · {row.daysWaiting === 0 ? "today" : `${row.daysWaiting}d`}
                </span>
              </li>
            ))}
            {remaining > 0 ? (
              <li className="opacity-80">+{remaining} more</li>
            ) : null}
          </ul>
        </div>
        <Link href="/accounting?tab=invoices" className="btn-secondary shrink-0 text-sm">
          Go to Accounting
        </Link>
      </div>
    </div>
  );
}
