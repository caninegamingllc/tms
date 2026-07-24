"use client";

import { useEffect, useState } from "react";
import { assignFleetToLoad, clearFleetAssignment } from "@/lib/fleet-actions";

type Option = { id: string; label: string };

type FleetCurrent = {
  driverId?: string | null;
  truckId?: string | null;
  trailerId?: string | null;
  driverName?: string | null;
  truckNumber?: string | null;
  trailerNumber?: string | null;
};

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
  current?: FleetCurrent | null;
}) {
  const [driverId, setDriverId] = useState(current?.driverId ?? "");
  const [truckId, setTruckId] = useState(current?.truckId ?? "");
  const [trailerId, setTrailerId] = useState(current?.trailerId ?? "");

  useEffect(() => {
    setDriverId(current?.driverId ?? "");
    setTruckId(current?.truckId ?? "");
    setTrailerId(current?.trailerId ?? "");
  }, [current?.driverId, current?.truckId, current?.trailerId]);

  const serverHasFleet = Boolean(current?.driverId || current?.truckId || current?.trailerId);
  const hasSelection = Boolean(driverId || truckId || trailerId);
  const currentSummary = [current?.driverName, current?.truckNumber, current?.trailerNumber]
    .filter(Boolean)
    .join(" · ");

  function clearFields() {
    setDriverId("");
    setTruckId("");
    setTrailerId("");
  }

  return (
    <div>
      <p className="muted mt-1">Assign your driver, tractor, and trailer.</p>
      {hasSelection && serverHasFleet ? (
        <p className="mt-3 text-sm text-foreground">
          Current: {currentSummary || "Fleet assets linked"}
        </p>
      ) : null}

      <form action={assignFleetToLoad} className="mt-4 grid gap-3 sm:grid-cols-3">
        <input type="hidden" name="loadId" value={loadId} />
        <label className="grid gap-1">
          <span className="label">Driver</span>
          <select
            className="input"
            name="driverId"
            value={driverId}
            onChange={(event) => setDriverId(event.target.value)}
          >
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
          <select
            className="input"
            name="truckId"
            value={truckId}
            onChange={(event) => setTruckId(event.target.value)}
          >
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
          <select
            className="input"
            name="trailerId"
            value={trailerId}
            onChange={(event) => setTrailerId(event.target.value)}
          >
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
            {hasSelection ? "Update fleet assignment" : "Assign fleet"}
          </button>
        </div>
      </form>

      {serverHasFleet ? (
        <form action={clearFleetAssignment} className="mt-3" onSubmit={clearFields}>
          <input type="hidden" name="loadId" value={loadId} />
          <button className="btn-secondary" type="submit">
            Clear fleet assets
          </button>
        </form>
      ) : null}
    </div>
  );
}
