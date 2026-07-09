"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { isEnrichedPlaceResult, type BusinessSearchResult } from "@/lib/business-search";
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

type ActiveField = "name" | "address" | null;

function createSessionToken() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatSuggestionLine(result: BusinessSearchResult) {
  if (result.description) {
    return result.description;
  }

  return [result.address, result.city, result.state, result.postalCode, result.phone]
    .filter(Boolean)
    .join(", ");
}

export function FacilityForm({ action, customers, facility }: FacilityFormProps) {
  const isEdit = Boolean(facility);

  const [name, setName] = useState(facility?.name ?? "");
  const [address, setAddress] = useState(facility?.address ?? "");
  const [city, setCity] = useState(facility?.city ?? "");
  const [state, setState] = useState(facility?.state ?? "");
  const [postalCode, setPostalCode] = useState(facility?.postalCode ?? "");
  const [phone, setPhone] = useState(facility?.phone ?? "");
  const [activeField, setActiveField] = useState<ActiveField>(null);
  const [results, setResults] = useState<BusinessSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const sessionTokenRef = useRef(createSessionToken());

  const trimmedName = useMemo(() => name.trim(), [name]);
  const trimmedAddress = useMemo(() => address.trim(), [address]);

  const activeQuery = useMemo(() => {
    if (activeField === "name") {
      return trimmedName;
    }

    if (activeField === "address") {
      return trimmedAddress;
    }

    return "";
  }, [activeField, trimmedAddress, trimmedName]);

  useEffect(() => {
    if (!activeField || activeQuery.length < 3) {
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        setLoading(true);
        setSearchError("");
        const params = new URLSearchParams({
          type: activeField === "name" ? "business" : "address",
          q: activeQuery,
          sessionToken: sessionTokenRef.current
        });
        const response = await fetch(`/api/business-search?${params.toString()}`, {
          signal: controller.signal
        });

        if (!response.ok) {
          if (response.status !== 429) {
            const payload = (await response.json().catch(() => null)) as { error?: string } | null;
            setSearchError(payload?.error ?? "Place search is unavailable.");
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
  }, [activeField, activeQuery]);

  function clearSearchState() {
    setResults([]);
    setSearchError("");
    setActiveField(null);
  }

  function applyPlaceDetails(details: BusinessSearchResult, fallback: BusinessSearchResult) {
    const resolvedName = details.name || fallback.name;
    const resolvedAddress = details.address || fallback.address;

    if (resolvedName) {
      setName(resolvedName);
    }
    if (resolvedAddress) {
      setAddress(resolvedAddress);
    }
    if (details.city) {
      setCity(details.city);
    }
    if (details.state) {
      setState(details.state);
    }
    if (details.postalCode) {
      setPostalCode(details.postalCode);
    }
    if (details.phone) {
      setPhone(details.phone);
    }
  }

  async function selectResult(result: BusinessSearchResult, field: ActiveField) {
    setResults([]);
    setSearchError("");

    if (field === "name" && isEnrichedPlaceResult(result)) {
      applyPlaceDetails(result, result);
      sessionTokenRef.current = createSessionToken();
      setActiveField(null);
      return;
    }

    setLoading(true);

    try {
      const params = new URLSearchParams({
        placeId: result.id,
        sessionToken: sessionTokenRef.current
      });
      if (field === "address") {
        params.set("context", "facility");
      }
      const response = await fetch(`/api/business-search?${params.toString()}`);

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setSearchError(payload?.error ?? "Could not load place details.");
        applyPlaceDetails(result, result);
        return;
      }

      const payload = (await response.json()) as { result?: BusinessSearchResult };
      const details = payload.result;
      if (!details) {
        applyPlaceDetails(result, result);
        return;
      }

      applyPlaceDetails(details, result);
    } finally {
      setLoading(false);
      sessionTokenRef.current = createSessionToken();
      setActiveField(null);
    }
  }

  function renderSuggestionsPanel(field: ActiveField) {
    if (activeField !== field || activeQuery.length < 3) {
      return null;
    }

    if (!(results.length > 0 || loading || searchError)) {
      return null;
    }

    return (
      <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-2xl border border-border bg-white shadow-card">
        {loading ? (
          <p className="px-4 py-3 text-sm text-muted">
            {field === "name" ? "Searching businesses..." : "Searching places..."}
          </p>
        ) : searchError ? (
          <p className="px-4 py-3 text-sm text-red-600">{searchError}</p>
        ) : (
          results.map((result) => (
            <button
              key={result.id}
              type="button"
              className="block w-full px-4 py-3 text-left text-sm transition hover:bg-soft"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectResult(result, field)}
            >
              <span className="font-semibold text-ink">{result.name}</span>
              {formatSuggestionLine(result) ? (
                <span className="block text-xs text-muted">{formatSuggestionLine(result)}</span>
              ) : null}
            </button>
          ))
        )}
      </div>
    );
  }

  const nameField = (
    <div className="relative">
      <input
        name="name"
        className="input"
        placeholder="Business name, city"
        required
        value={name}
        autoComplete="off"
        onChange={(event) => {
          const nextValue = event.target.value;
          setName(nextValue);
          setSearchError("");
          setActiveField("name");
          if (nextValue.trim().length < 3) {
            setResults([]);
            setLoading(false);
            sessionTokenRef.current = createSessionToken();
          }
        }}
        onBlur={() => {
          window.setTimeout(() => {
            if (activeField === "name") {
              clearSearchState();
            }
          }, 150);
        }}
      />
      {renderSuggestionsPanel("name")}
    </div>
  );

  const addressField = (
    <div className={isEdit ? "relative md:col-span-2" : "relative"}>
      <input
        name="address"
        className="input"
        placeholder={isEdit ? "Address or business" : "Street address or business"}
        value={address}
        autoComplete="off"
        onChange={(event) => {
          const nextValue = event.target.value;
          setAddress(nextValue);
          setSearchError("");
          setActiveField("address");
          if (nextValue.trim().length < 3) {
            setResults([]);
            setLoading(false);
            sessionTokenRef.current = createSessionToken();
          }
        }}
        onBlur={() => {
          window.setTimeout(() => {
            if (activeField === "address") {
              clearSearchState();
            }
          }, 150);
        }}
      />
      {renderSuggestionsPanel("address")}
    </div>
  );

  return (
    <form
      action={action}
      className={isEdit ? "grid gap-3 rounded-2xl border border-border p-4" : "mt-4 grid gap-3"}
    >
      {facility ? <input type="hidden" name="facilityId" value={facility.id} /> : null}

      <div className="grid gap-3 md:grid-cols-3">
        {nameField}
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

      {!isEdit ? (
        <p className="text-xs text-muted">
          Type a business name, then add a city to narrow results (e.g. &quot;Acme Warehouse, Dallas&quot;). Address
          search returns matching businesses with phone numbers when available.
        </p>
      ) : null}

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
        <input name="contactName" className="input" placeholder="Contact" defaultValue={facility?.contactName ?? ""} />
        <input
          name="phone"
          className="input"
          placeholder="Phone"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
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
