"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type SearchOption = {
  id: string;
  label: string;
  description?: string;
};

type FacilityOption = SearchOption & {
  address?: string | null;
  city: string;
  state: string;
  postalCode?: string | null;
};

export function SearchCombobox({
  name,
  label,
  placeholder,
  options,
  required,
  defaultValue,
  className,
  onValueChange
}: {
  name: string;
  label?: string;
  placeholder: string;
  options: SearchOption[];
  required?: boolean;
  defaultValue?: string;
  className?: string;
  onValueChange?: (id: string) => void;
}) {
  const initialOption = options.find((option) => option.id === defaultValue);
  const [query, setQuery] = useState(initialOption?.label ?? "");
  const [selectedId, setSelectedId] = useState(initialOption?.id ?? "");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLLabelElement>(null);

  function selectValue(id: string, labelText?: string) {
    setSelectedId(id);
    if (labelText !== undefined) {
      setQuery(labelText);
    }
    onValueChange?.(id);
  }

  // Keep visible text in sync when the server default changes (e.g. unassign carrier).
  useEffect(() => {
    const option = options.find((item) => item.id === defaultValue);
    setSelectedId(defaultValue ?? "");
    setQuery(option?.label ?? "");
    // Only react to the assigned value changing; remounting via form key also resets state.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- options identity changes every render
  }, [defaultValue]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return options.slice(0, 8);
    }

    return options
      .filter((option) =>
        `${option.label} ${option.description ?? ""}`.toLowerCase().includes(normalized)
      )
      .slice(0, 8);
  }, [options, query]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  return (
    <label className={["relative grid gap-2", className].filter(Boolean).join(" ")} ref={rootRef}>
      {label ? <span className="label">{label}</span> : null}
      <input type="hidden" name={name} value={selectedId} />
      <input
        className="input"
        value={query}
        onChange={(event) => {
          const value = event.target.value;
          setQuery(value);
          setOpen(true);
          if (options.find((option) => option.id === selectedId)?.label !== value) {
            selectValue("");
          }
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        required={required && !selectedId}
        autoComplete="off"
      />
      {open && filtered.length ? (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-border bg-card shadow-card">
          {filtered.map((option) => (
            <button
              key={option.id}
              type="button"
              className="block w-full px-4 py-3 text-left text-sm transition hover:bg-muted"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                selectValue(option.id, option.label);
                setOpen(false);
              }}
            >
              <span className="font-semibold text-foreground">{option.label}</span>
              {option.description ? (
                <span className="block text-xs text-muted-foreground">{option.description}</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </label>
  );
}

export function FacilityCombobox({
  prefix,
  legend,
  facilities,
  fieldNames,
  defaultFacilityId,
  defaultFacility,
  defaultCity,
  defaultState,
  defaultAddress,
  defaultPostalCode
}: {
  prefix?: string;
  legend: string;
  facilities: FacilityOption[];
  fieldNames?: {
    facilityId?: string;
    facility?: string;
    address?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  };
  defaultFacilityId?: string;
  defaultFacility?: string;
  defaultCity?: string;
  defaultState?: string;
  defaultAddress?: string;
  defaultPostalCode?: string;
}) {
  const namePrefix = prefix ?? "facility";
  const names = {
    facilityId: fieldNames?.facilityId ?? `${namePrefix}FacilityId`,
    facility: fieldNames?.facility ?? `${namePrefix}Facility`,
    address: fieldNames?.address ?? `${namePrefix}Address`,
    city: fieldNames?.city ?? `${namePrefix}City`,
    state: fieldNames?.state ?? `${namePrefix}State`,
    postalCode: fieldNames?.postalCode ?? `${namePrefix}PostalCode`
  };
  const [facilityId, setFacilityId] = useState(defaultFacilityId ?? "");
  const [facilityName, setFacilityName] = useState(defaultFacility ?? "");
  const [address, setAddress] = useState(defaultAddress ?? "");
  const [city, setCity] = useState(defaultCity ?? "");
  const [state, setState] = useState(defaultState ?? "");
  const [postalCode, setPostalCode] = useState(defaultPostalCode ?? "");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLLabelElement>(null);

  const filtered = useMemo(() => {
    const normalized = facilityName.trim().toLowerCase();
    if (!normalized) {
      return facilities.slice(0, 8);
    }

    return facilities
      .filter((facility) =>
        `${facility.label} ${facility.description ?? ""} ${facility.city} ${facility.state}`
          .toLowerCase()
          .includes(normalized)
      )
      .slice(0, 8);
  }, [facilities, facilityName]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function selectFacility(facility: FacilityOption) {
    setFacilityId(facility.id);
    setFacilityName(facility.label);
    setAddress(facility.address ?? "");
    setCity(facility.city);
    setState(facility.state);
    setPostalCode(facility.postalCode ?? "");
    setOpen(false);
  }

  return (
    <fieldset className="grid gap-4 rounded-lg border border-border p-4">
      <legend className="px-2 text-sm font-semibold text-foreground">{legend}</legend>
      <input type="hidden" name={names.facilityId} value={facilityId} />
      <label className="relative grid gap-2" ref={rootRef}>
        <span className="label">Facility</span>
        <input
          name={names.facility}
          className="input"
          value={facilityName}
          onChange={(event) => {
            setFacilityName(event.target.value);
            setFacilityId("");
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Start typing a saved location or enter a new one"
          required
          autoComplete="off"
        />
        {open && facilityName && filtered.length ? (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-border bg-card shadow-card">
            {filtered.map((facility) => (
              <button
                key={facility.id}
                type="button"
                className="block w-full px-4 py-3 text-left text-sm transition hover:bg-muted"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectFacility(facility)}
              >
                <span className="font-semibold text-foreground">{facility.label}</span>
                <span className="block text-xs text-muted-foreground">
                  {facility.address ? `${facility.address}, ` : ""}
                  {facility.city}, {facility.state} {facility.postalCode ?? ""}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </label>
      <label className="grid gap-2">
        <span className="label">Address</span>
        <input
          name={names.address}
          className="input"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
        />
      </label>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-2">
          <span className="label">City</span>
          <input
            name={names.city}
            className="input"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            required
          />
        </label>
        <label className="grid gap-2">
          <span className="label">State</span>
          <input
            name={names.state}
            className="input"
            value={state}
            onChange={(event) => setState(event.target.value)}
            maxLength={2}
            required
          />
        </label>
        <label className="grid gap-2">
          <span className="label">Postal Code</span>
          <input
            name={names.postalCode}
            className="input"
            value={postalCode}
            onChange={(event) => setPostalCode(event.target.value)}
          />
        </label>
      </div>
    </fieldset>
  );
}
