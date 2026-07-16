"use client";

import { assignFleetToLoad, clearFleetAssignment } from "@/lib/fleet-actions";

type Option = { id: string; label: string };

export function FleetAssignmentPanel({
  loadId,
  drivers,
  trucks,
  trailers,
  current
}: {
  loadId: string;
  drivers: Option[];
  trucks: Option[];
  trailers: Option[];
  current?: {
    driverId?: string | null;
    truckId?: string | null;
    trailerId?: string | null;
    driverName?: string | null;
    truckNumber?: string | null;
    trailerNumber?: string | null;
  } | null;
}) {
  const hasFleet = Boolean(current?.driverId || current?.truckId || current?.trailerId);

  return (
    <div>
      <p className="muted mt-1">Assign your driver, tractor, and trailer.</p>
      {hasFleet ? (
        <p className="mt-3 text-sm text-foreground">
          Current:{" "}
          {[current?.driverName, current?.truckNumber, current?.trailerNumber]
            .filter(Boolean)
            .join(" · ") || "Fleet assets linked"}
        </p>
      ) : null}

      <form action={assignFleetToLoad} className="mt-4 grid gap-3 sm:grid-cols-3">
        <input type="hidden" name="loadId" value={loadId} />
        <label className="grid gap-1">
          <span className="label">Driver</span>
          <select className="input" name="driverId" defaultValue={current?.driverId ?? ""}>
            <option value="">Select driver</option>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="label">Tractor</span>
          <select className="input" name="truckId" defaultValue={current?.truckId ?? ""}>
            <option value="">Select tractor</option>
            {trucks.map((truck) => (
              <option key={truck.id} value={truck.id}>
                {truck.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="label">Trailer</span>
          <select className="input" name="trailerId" defaultValue={current?.trailerId ?? ""}>
            <option value="">Select trailer</option>
            {trailers.map((trailer) => (
              <option key={trailer.id} value={trailer.id}>
                {trailer.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2 sm:col-span-3">
          <button className="btn" type="submit">
            {hasFleet ? "Update fleet assignment" : "Assign fleet"}
          </button>
        </div>
      </form>

      {hasFleet ? (
        <form action={clearFleetAssignment} className="mt-3">
          <input type="hidden" name="loadId" value={loadId} />
          <button className="btn-secondary" type="submit">
            Clear fleet assets
          </button>
        </form>
      ) : null}
    </div>
  );
}
