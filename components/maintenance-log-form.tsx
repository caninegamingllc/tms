import { addMaintenanceLog } from "@/lib/fleet-actions";

export function MaintenanceLogForm({
  assetType,
  assetId,
  workTypes
}: {
  assetType: "TRUCK" | "TRAILER";
  assetId: string;
  workTypes: readonly string[];
}) {
  return (
    <form action={addMaintenanceLog} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="assetType" value={assetType} />
      <input type="hidden" name="assetId" value={assetId} />
      <label className="grid gap-1">
        <span className="label">Date</span>
        <input
          className="input"
          name="performedAt"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
        />
      </label>
      <label className="grid gap-1">
        <span className="label">Work type</span>
        <select className="input" name="workType" defaultValue="PM">
          {workTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1">
        <span className="label">Odometer</span>
        <input className="input" name="odometer" type="number" />
      </label>
      <label className="grid gap-1">
        <span className="label">Cost (USD)</span>
        <input className="input" name="cost" type="number" step="0.01" defaultValue="0" />
      </label>
      <label className="grid gap-1">
        <span className="label">Vendor</span>
        <input className="input" name="vendor" />
      </label>
      <label className="grid gap-1 sm:col-span-2">
        <span className="label">Notes</span>
        <textarea className="input min-h-[70px]" name="notes" />
      </label>
      <div className="sm:col-span-2">
        <button className="btn" type="submit">
          Add maintenance entry
        </button>
      </div>
    </form>
  );
}
