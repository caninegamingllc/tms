"use client";

import {
  DriverPayLinesEditor,
  type DriverPayLineTypeOption,
  type InitialDriverPayLine
} from "@/components/driver-pay-lines-editor";
import { saveDriverPayLines } from "@/lib/fleet-actions";
import { formatMoney } from "@/lib/format";

export function DriverPayPanel({
  loadId,
  lineTypes,
  initialLines,
  defaultMiles,
  eligibleRevenueCents,
  driverPayCents,
  locked
}: {
  loadId: string;
  lineTypes: DriverPayLineTypeOption[];
  initialLines: InitialDriverPayLine[];
  defaultMiles?: number | null;
  eligibleRevenueCents: number;
  driverPayCents: number;
  locked?: boolean;
}) {
  return (
    <div className="mt-6 rounded-2xl border border-border p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Driver pay</h3>
          <p className="muted text-xs">
            Flat, per mile, or % of eligible revenue. Seeded from the driver profile when assigned.
          </p>
        </div>
        <p className="text-sm font-semibold">{formatMoney(driverPayCents)}</p>
      </div>
      {locked ? (
        <p className="text-sm text-muted-foreground">
          Driver pay is locked because lines are already on a settlement, or the load is invoiced/paid.
        </p>
      ) : (
        <form action={saveDriverPayLines} className="grid gap-3">
          <input type="hidden" name="loadId" value={loadId} />
          <DriverPayLinesEditor
            lineTypes={lineTypes}
            initialLines={initialLines}
            defaultMiles={defaultMiles}
            eligibleRevenueCents={eligibleRevenueCents}
          />
          <div>
            <button className="btn" type="submit">
              Save driver pay
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
