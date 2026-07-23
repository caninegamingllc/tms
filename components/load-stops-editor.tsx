"use client";

import { useState } from "react";
import { FacilityCombobox, type SearchOption } from "@/components/search-combobox";
import { DateTimePicker } from "@/components/ui/date-picker";
import { formatLocalDateTime } from "@/lib/dates";

type FacilityOption = SearchOption & {
  address?: string | null;
  city: string;
  state: string;
  postalCode?: string | null;
};

export type InitialLoadStop = {
  type: "PICKUP" | "DELIVERY" | string;
  facilityId?: string | null;
  facilityName: string;
  address?: string | null;
  city: string;
  state: string;
  postalCode?: string | null;
  appointmentAt?: Date | string | null;
  appointmentEndAt?: Date | string | null;
  instructions?: string | null;
};

type DraftStop = {
  key: string;
  type: "PICKUP" | "DELIVERY";
  facilityId: string;
  facilityName: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  appointmentAt: string;
  hasWindow: boolean;
  appointmentEndAt: string;
  instructions: string;
};

function newKey() {
  return `stop-${Math.random().toString(36).slice(2, 10)}`;
}

function toDatetimeLocalValue(value: Date | string | null | undefined) {
  if (!value) {
    return "";
  }
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return formatLocalDateTime(date);
}

function emptyStop(type: "PICKUP" | "DELIVERY"): DraftStop {
  return {
    key: newKey(),
    type,
    facilityId: "",
    facilityName: "",
    address: "",
    city: "",
    state: "",
    postalCode: "",
    appointmentAt: "",
    hasWindow: false,
    appointmentEndAt: "",
    instructions: ""
  };
}

function fromInitial(stop: InitialLoadStop): DraftStop {
  const type = stop.type.toUpperCase() === "DELIVERY" ? "DELIVERY" : "PICKUP";
  const appointmentEndAt = toDatetimeLocalValue(stop.appointmentEndAt);
  return {
    key: newKey(),
    type,
    facilityId: stop.facilityId ?? "",
    facilityName: stop.facilityName ?? "",
    address: stop.address ?? "",
    city: stop.city ?? "",
    state: stop.state ?? "",
    postalCode: stop.postalCode ?? "",
    appointmentAt: toDatetimeLocalValue(stop.appointmentAt),
    hasWindow: Boolean(appointmentEndAt),
    appointmentEndAt,
    instructions: stop.instructions ?? ""
  };
}

export function LoadStopsEditor({
  facilities,
  initialStops,
  showHeader = true
}: {
  facilities: FacilityOption[];
  initialStops?: InitialLoadStop[];
  showHeader?: boolean;
}) {
  const [stops, setStops] = useState<DraftStop[]>(() => {
    if (initialStops?.length) {
      return initialStops.map(fromInitial);
    }
    return [emptyStop("PICKUP"), emptyStop("DELIVERY")];
  });

  function updateStop(key: string, patch: Partial<DraftStop>) {
    setStops((prev) => prev.map((stop) => (stop.key === key ? { ...stop, ...patch } : stop)));
  }

  function addStop(type: "PICKUP" | "DELIVERY") {
    setStops((prev) => [...prev, emptyStop(type)]);
  }

  function removeStop(key: string) {
    setStops((prev) => {
      if (prev.length <= 2) {
        return prev;
      }
      return prev.filter((stop) => stop.key !== key);
    });
  }

  function moveStop(key: string, direction: -1 | 1) {
    setStops((prev) => {
      const index = prev.findIndex((stop) => stop.key === key);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= prev.length) {
        return prev;
      }
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, item);
      return copy;
    });
  }

  return (
    <div className="grid gap-4">
      {showHeader ? (
        <div>
          <h3 className="text-sm font-semibold text-foreground">Stops</h3>
          <p className="muted text-sm">
            Add multiple pickups and deliveries in route order. At least one of each is required.
          </p>
        </div>
      ) : null}

      {stops.map((stop, index) => (
        <div key={stop.key} className="grid gap-3 rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-foreground">Stop {index + 1}</p>
              <select
                className="select w-auto"
                name="stopType"
                value={stop.type}
                onChange={(event) =>
                  updateStop(stop.key, {
                    type: event.target.value === "DELIVERY" ? "DELIVERY" : "PICKUP"
                  })
                }
              >
                <option value="PICKUP">Pickup</option>
                <option value="DELIVERY">Delivery</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => moveStop(stop.key, -1)}
                disabled={index === 0}
              >
                Up
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => moveStop(stop.key, 1)}
                disabled={index === stops.length - 1}
              >
                Down
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => removeStop(stop.key)}
                disabled={stops.length <= 2}
              >
                Remove
              </button>
            </div>
          </div>

          <FacilityCombobox
            prefix={`stop${index}`}
            legend={stop.type === "PICKUP" ? "Pickup facility" : "Delivery facility"}
            facilities={facilities}
            fieldNames={{
              facilityId: "stopFacilityId",
              facility: "stopFacility",
              address: "stopAddress",
              city: "stopCity",
              state: "stopState",
              postalCode: "stopPostalCode"
            }}
            defaultFacilityId={stop.facilityId || undefined}
            defaultFacility={stop.facilityName}
            defaultAddress={stop.address}
            defaultCity={stop.city}
            defaultState={stop.state}
            defaultPostalCode={stop.postalCode}
          />

          <div className="grid gap-3 md:max-w-sm">
            <label className="grid gap-2">
              <span className="label">Appointment</span>
              <DateTimePicker
                name="stopAppointment"
                value={stop.appointmentAt}
                onChange={(next) => updateStop(stop.key, { appointmentAt: next })}
                required
                placeholder="Appointment date & time"
              />
            </label>

            <input type="hidden" name="stopHasWindow" value={stop.hasWindow ? "1" : "0"} />
            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                checked={stop.hasWindow}
                onChange={(event) =>
                  updateStop(stop.key, {
                    hasWindow: event.target.checked,
                    appointmentEndAt: event.target.checked ? stop.appointmentEndAt : ""
                  })
                }
              />
              Window
            </label>

            {stop.hasWindow ? (
              <label className="grid gap-2">
                <span className="label">Window end</span>
                <DateTimePicker
                  name="stopAppointmentEnd"
                  value={stop.appointmentEndAt}
                  onChange={(next) => updateStop(stop.key, { appointmentEndAt: next })}
                  required
                  placeholder="Window end date & time"
                />
              </label>
            ) : (
              <input type="hidden" name="stopAppointmentEnd" value="" />
            )}
          </div>

          <label className="grid gap-2">
            <span className="label">Instructions</span>
            <textarea
              name="stopInstructions"
              className="textarea"
              rows={2}
              value={stop.instructions}
              onChange={(event) => updateStop(stop.key, { instructions: event.target.value })}
            />
          </label>
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary" onClick={() => addStop("PICKUP")}>
          Add pickup
        </button>
        <button type="button" className="btn-secondary" onClick={() => addStop("DELIVERY")}>
          Add delivery
        </button>
      </div>
    </div>
  );
}
