"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { BusinessSearchResult } from "@/lib/business-search";
import { facilityTypes } from "@/lib/constants";
import { humanize } from "@/lib/format";

type CustomerOption = {
  id: string;
  name: string;
};

type FacilityFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  customers: CustomerOption[];
  facility?: {
    id: string;
    name: string;
    type: string;
    status: string;
    address: string | null;
    city: string;
    state: string;
    postalCode: string | null;
    contactName: string | null;
    phone: string | null;
    email: string | null;
    customerId: string | null;
    notes: string | null;
  };
};

function createSessionToken() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function FacilityForm({ action, customers, facility }: FacilityFormProps) {
  const isEdit = Boolean(facility);

  const [address, setAddress] = useState(facility?.address ?? "");
  const [city, setCity] = useState(facility?.city ?? "");
  const [state, setState] = useState(facility?.state ?? "");
  const [postalCode, setPostalCode] = useState(facility?.postalCode ?? "");
  const [results, setResults] = useState<BusinessSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const sessionTokenRef = useRef(createSessionToken());

  const trimmedAddress = useMemo(() => address.trim(), [address]);

  useEffect(() => {
    if (trimmedAddress.length < 3) {
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        setLoading(true);
        setSearchError("");
        const params = new URLSearchParams({
          type: "address",
          q: trimmedAddress,
          sessionToken: sessionTokenRef.current
        });
        const response = await fetch(`/api/business-search?${params.toString()}`, {
          signal: controller.signal
        });

        if (!response.ok) {
          if (response.status !== 429) {
            const payload = (await response.json().catch(() => null)) as { error?: string } | null;
            setSearchError(payload?.error ?? "Address search is unavailable.");
          }
          return;
        }

        const payload = (await response.json()) as { results?: BusinessSearchResult[] };
        setResults(payload.results ?? []);
      } catch {
        if (!controller.signal.aborted) {
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 450);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [trimmedAddress]);

  async function selectResult(result: BusinessSearchResult) {
    setResults([]);
    setLoading(true);
    setSearchError("");

    try {
      const params = new URLSearchParams({
        placeId: result.id,
        sessionToken: sessionTokenRef.current
      });
      const response = await fetch(`/api/business-search?${params.toString()}`);

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setSearchError(payload?.error ?? "Could not load address details.");
        setAddress(result.address || result.name);
        return;
      }

      const payload = (await response.json()) as { result?: BusinessSearchResult };
      const details = payload.result;
      if (!details) {
        setAddress(result.address || result.name);
        return;
      }

      setAddress(details.address || result.address || result.name);
      setCity(details.city);
      setState(details.state);
      setPostalCode(details.postalCode);
    } finally {
      setLoading(false);
      sessionTokenRef.current = createSessionToken();
    }
  }

  const suggestionsPanel =
    trimmedAddress.length >= 3 && (results.length > 0 || loading || searchError) ? (
      <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-2xl border border-border bg-white shadow-card">
        {loading ? (
          <p className="px-4 py-3 text-sm text-muted">Searching addresses...</p>
        ) : searchError ? (
          <p className="px-4 py-3 text-sm text-red-600">{searchError}</p>
        ) : (
          results.map((result) => (
            <button
              key={result.id}
              type="button"
              className="block w-full px-4 py-3 text-left text-sm transition hover:bg-soft"
              onClick={() => selectResult(result)}
            >
              <span className="font-semibold text-ink">{result.address || result.name}</span>
              {result.description ? (
                <span className="block text-xs text-muted">{result.description}</span>
              ) : null}
            </button>
          ))
        )}
      </div>
    ) : null;

  const addressField = (
    <div className={isEdit ? "relative md:col-span-2" : "relative"}>
      <input
        name="address"
        className="input"
        placeholder={isEdit ? "Address" : "Street address"}
        value={address}
        onChange={(event) => {
          const nextValue = event.target.value;
          setAddress(nextValue);
          setSearchError("");
          if (nextValue.trim().length < 3) {
            setResults([]);
            setLoading(false);
            sessionTokenRef.current = createSessionToken();
          }
        }}
        autoComplete="off"
      />
      {suggestionsPanel}
    </div>
  );

  return (
    <form
      action={action}
      className={isEdit ? "grid gap-3 rounded-2xl border border-border p-4" : "mt-4 grid gap-3"}
    >
      {facility ? <input type="hidden" name="facilityId" value={facility.id} /> : null}

      <div className="grid gap-3 md:grid-cols-3">
        <input
          name="name"
          className="input"
          placeholder="Facility name"
          defaultValue={facility?.name}
          required
        />
        <select name="type" className="select" defaultValue={facility?.type ?? "GENERAL"}>
          {facilityTypes.map((type) => (
            <option key={type} value={type}>
              {humanize(type)}
            </option>
          ))}
        </select>
        <select name="status" className="select" defaultValue={facility?.status ?? "Active"}>
          <option>Active</option>
          <option>Inactive</option>
        </select>
      </div>

      {isEdit ? (
        <div className="grid gap-3 md:grid-cols-4">
          {addressField}
          <input
            name="city"
            className="input"
            placeholder="City"
            required
            value={city}
            onChange={(event) => setCity(event.target.value)}
          />
          <input
            name="state"
            className="input"
            placeholder="State"
            maxLength={2}
            required
            value={state}
            onChange={(event) => setState(event.target.value.toUpperCase())}
          />
        </div>
      ) : (
        <div className="grid gap-3">
          <label className="grid gap-2">
            <span className="label">Street address</span>
            {addressField}
            <p className="text-xs text-muted">Address suggestions powered by Google.</p>
          </label>
          <div className="grid gap-3 md:grid-cols-3">
            <input
              name="city"
              className="input"
              placeholder="City"
              required
              value={city}
              onChange={(event) => setCity(event.target.value)}
            />
            <input
              name="state"
              className="input"
              placeholder="State"
              maxLength={2}
              required
              value={state}
              onChange={(event) => setState(event.target.value.toUpperCase())}
            />
            <input
              name="postalCode"
              className="input"
              placeholder="Postal code"
              value={postalCode}
              onChange={(event) => setPostalCode(event.target.value)}
            />
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-4">
        {isEdit ? (
          <input
            name="postalCode"
            className="input"
            placeholder="Postal code"
            value={postalCode}
            onChange={(event) => setPostalCode(event.target.value)}
          />
        ) : null}
        <input
          name="contactName"
          className="input"
          placeholder="Contact"
          defaultValue={facility?.contactName ?? ""}
        />
        <input
          name="phone"
          className="input"
          placeholder="Phone"
          defaultValue={facility?.phone ?? ""}
        />
        <input
          name="email"
          className="input"
          placeholder="Email"
          type="email"
          defaultValue={facility?.email ?? ""}
        />
      </div>

      <select name="customerId" className="select" defaultValue={facility?.customerId ?? ""}>
        <option value="">No customer link</option>
        {customers.map((customer) => (
          <option key={customer.id} value={customer.id}>
            {customer.name}
          </option>
        ))}
      </select>

      <textarea
        name="notes"
        className="textarea"
        placeholder="Notes"
        rows={isEdit ? 2 : 3}
        defaultValue={facility?.notes ?? ""}
      />

      <div className={isEdit ? "flex justify-end" : undefined}>
        <button className={isEdit ? "btn-secondary" : "btn"} type="submit">
          Save Location
        </button>
      </div>
    </form>
  );
}
