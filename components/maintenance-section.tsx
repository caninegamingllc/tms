import { MaintenanceLogForm } from "@/components/maintenance-log-form";
import { MAINTENANCE_WORK_TYPES } from "@/lib/fleet-constants";
import { formatDate, formatMoney, humanize } from "@/lib/format";

type Log = {
  id: string;
  performedAt: Date;
  workType: string;
  odometer: number | null;
  costCents: number;
  vendor: string | null;
  notes: string | null;
};

export function MaintenanceSection({
  assetType,
  assetId,
  logs
}: {
  assetType: "TRUCK" | "TRAILER";
  assetId: string;
  logs: Log[];
}) {
  return (
    <div className="card mt-6">
      <h2 className="mb-4 text-lg font-semibold">Maintenance log</h2>
      {logs.length === 0 ? (
        <p className="muted mb-4">No maintenance entries yet.</p>
      ) : (
        <div className="mb-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Odometer</th>
                <th className="py-2 pr-3">Cost</th>
                <th className="py-2">Vendor / notes</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-border/60">
                  <td className="py-2 pr-3">{formatDate(log.performedAt)}</td>
                  <td className="py-2 pr-3">{humanize(log.workType)}</td>
                  <td className="py-2 pr-3">{log.odometer ?? "—"}</td>
                  <td className="py-2 pr-3">{formatMoney(log.costCents)}</td>
                  <td className="py-2">
                    {[log.vendor, log.notes].filter(Boolean).join(" — ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <h3 className="mb-3 text-sm font-semibold">Add entry</h3>
      <MaintenanceLogForm assetType={assetType} assetId={assetId} workTypes={MAINTENANCE_WORK_TYPES} />
    </div>
  );
}
