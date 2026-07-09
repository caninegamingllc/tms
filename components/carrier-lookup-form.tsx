"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CarrierLookupResult } from "@/lib/carrier-lookup";

type CarrierLookupFormProps = {
  action: (formData: FormData) => void | Promise<void>;
};

type ActiveField = "mc" | "dot" | null;

function resultLabel(result: CarrierLookupResult) {
  return result.source === "local" ? "Existing carrier in TMS" : "FMCSA match";
}

export function CarrierLookupForm({ action }: CarrierLookupFormProps) {
  const [name, setName] = useState("");
  const [mcNumber, setMcNumber] = useState("");
  const [dotNumber, setDotNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [equipmentTypes, setEquipmentTypes] = useState("");
  const [safetyRating, setSafetyRating] = useState("");
  const [complianceStatus, setComplianceStatus] = useState("Needs Review");
  const [status, setStatus] = useState("Active");
  const [insuranceExpiresAt, setInsuranceExpiresAt] = useState("");
  const [activeField, setActiveField] = useState<ActiveField>(null);
  const [results, setResults] = useState<CarrierLookupResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [selectedLocalCarrierId, setSelectedLocalCarrierId] = useState<string | null>(null);
  const [fmcsaAvailable, setFmcsaAvailable] = useState(true);
  const [hasSearched, setHasSearched] = useState(false);

  const activeQuery = useMemo(() => {
    if (activeField === "mc") {
      return mcNumber.trim();
    }

    if (activeField === "dot") {
      return dotNumber.trim();
    }

    return "";
  }, [activeField, dotNumber, mcNumber]);

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
          type: activeField,
          q: activeQuery
        });
        const response = await fetch(`/api/carriers/lookup?${params.toString()}`, {
          signal: controller.signal
        });

        if (!response.ok) {
          if (response.status !== 429) {
            const payload = (await response.json().catch(() => null)) as { error?: string } | null;
            setSearchError(payload?.error ?? "Carrier lookup is unavailable.");
          }
          return;
        }

        const payload = (await response.json()) as {
          results?: CarrierLookupResult[];
          fmcsaAvailable?: boolean;
        };
        setResults(payload.results ?? []);
        setFmcsaAvailable(payload.fmcsaAvailable ?? true);
        setHasSearched(true);
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

  function clearLookupState() {
    setResults([]);
    setSearchError("");
    setSelectedLocalCarrierId(null);
    setHasSearched(false);
  }

  function applyLookupResult(result: CarrierLookupResult) {
    setName(result.name);
    if (result.mcNumber) {
      setMcNumber(result.mcNumber);
    }
    if (result.dotNumber) {
      setDotNumber(result.dotNumber);
    }
    if (result.phone) {
      setPhone(result.phone);
    }
    if (result.email) {
      setEmail(result.email);
    }
    if (result.address) {
      setAddress(result.address);
    }
    if (result.city) {
      setCity(result.city);
    }
    if (result.state) {
      setState(result.state);
    }
    if (result.postalCode) {
      setPostalCode(result.postalCode);
    }
    if (result.equipmentTypes) {
      setEquipmentTypes(result.equipmentTypes);
    }
    if (result.safetyRating) {
      setSafetyRating(result.safetyRating);
    }
    if (result.complianceStatus) {
      setComplianceStatus(result.complianceStatus);
    }
    setSelectedLocalCarrierId(null);
    clearLookupState();
    setActiveField(null);
  }

  function selectResult(result: CarrierLookupResult) {
    if (result.source === "local" && result.carrierId) {
      setSelectedLocalCarrierId(result.carrierId);
      clearLookupState();
      setActiveField(null);
      return;
    }

    applyLookupResult(result);
  }

  function renderLookupPanel(field: ActiveField) {
    if (activeField !== field || activeQuery.length < 3) {
      return null;
    }

    if (loading || searchError || results.length > 0) {
      return (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-2xl border border-border bg-white shadow-card">
          {loading ? (
            <p className="px-4 py-3 text-sm text-muted">Searching carriers...</p>
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
                <span className="font-semibold text-ink">{result.name}</span>
                <span className="block text-xs text-muted">{result.description}</span>
                <span className="mt-1 block text-[11px] font-semibold uppercase tracking-wide text-brand-700">
                  {resultLabel(result)}
                </span>
              </button>
            ))
          )}
        </div>
      );
    }

    if (hasSearched) {
      return (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-2xl border border-border bg-white shadow-card">
          <p className="px-4 py-3 text-sm text-muted">No matches found.</p>
        </div>
      );
    }

    return null;
  }

  return (
    <form action={action} className="mt-4 grid gap-3">
      <input
        name="name"
        className="input"
        placeholder="Carrier name"
        required
        value={name}
        onChange={(event) => setName(event.target.value)}
      />

      <div className="grid gap-3 md:grid-cols-2">
        <label className="relative grid gap-2">
          <span className="label">MC number</span>
          <input
            name="mcNumber"
            className="input"
            placeholder="MC number"
            value={mcNumber}
            autoComplete="off"
            onChange={(event) => {
              const nextValue = event.target.value;
              setMcNumber(nextValue);
              setSelectedLocalCarrierId(null);
              setActiveField("mc");
              if (nextValue.trim().length < 3) {
                clearLookupState();
                setLoading(false);
              }
            }}
          />
          {renderLookupPanel("mc")}
        </label>

        <label className="relative grid gap-2">
          <span className="label">DOT number</span>
          <input
            name="dotNumber"
            className="input"
            placeholder="DOT number"
            value={dotNumber}
            autoComplete="off"
            onChange={(event) => {
              const nextValue = event.target.value;
              setDotNumber(nextValue);
              setSelectedLocalCarrierId(null);
              setActiveField("dot");
              if (nextValue.trim().length < 3) {
                clearLookupState();
                setLoading(false);
              }
            }}
          />
          {renderLookupPanel("dot")}
        </label>
      </div>

      {selectedLocalCarrierId ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          This carrier already exists in your TMS.{" "}
          <Link href={`/carriers/${selectedLocalCarrierId}`} className="font-semibold text-brand-700">
            Open existing carrier
          </Link>
        </div>
      ) : null}

      <p className="text-xs text-muted">
        {fmcsaAvailable
          ? "Lookup checks your carrier network first, then FMCSA when no local match is found."
          : "Lookup checks your carrier network. Add FMCSA_WEB_KEY to enable federal carrier search."}
      </p>

      <input
        name="address"
        className="input"
        placeholder="Address"
        value={address}
        onChange={(event) => setAddress(event.target.value)}
      />
      <div className="grid gap-3 md:grid-cols-3">
        <input
          name="city"
          className="input"
          placeholder="City"
          value={city}
          onChange={(event) => setCity(event.target.value)}
        />
        <input
          name="state"
          className="input"
          placeholder="State"
          maxLength={2}
          value={state}
          onChange={(event) => setState(event.target.value.toUpperCase())}
        />
        <input
          name="postalCode"
          className="input"
          placeholder="Zip"
          value={postalCode}
          onChange={(event) => setPostalCode(event.target.value)}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
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
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>

      <input
        name="equipmentTypes"
        className="input"
        placeholder="Dry Van, Reefer, Flatbed"
        value={equipmentTypes}
        onChange={(event) => setEquipmentTypes(event.target.value)}
      />

      <div className="grid gap-3 md:grid-cols-2">
        <select
          name="status"
          className="select"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option>Active</option>
          <option>Prospect</option>
          <option>Do Not Use</option>
          <option>Inactive</option>
        </select>
        <select
          name="complianceStatus"
          className="select"
          value={complianceStatus}
          onChange={(event) => setComplianceStatus(event.target.value)}
        >
          <option>Approved</option>
          <option>Needs Review</option>
          <option>Review Soon</option>
          <option>Blocked</option>
        </select>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <input
          name="safetyRating"
          className="input"
          placeholder="Safety rating"
          value={safetyRating}
          onChange={(event) => setSafetyRating(event.target.value)}
        />
        <input
          name="insuranceExpiresAt"
          className="input"
          type="date"
          value={insuranceExpiresAt}
          onChange={(event) => setInsuranceExpiresAt(event.target.value)}
        />
      </div>

      <div className="rounded-2xl bg-soft p-4">
        <p className="mb-3 text-sm font-semibold text-ink">Primary Dispatch Contact</p>
        <div className="grid gap-3">
          <input name="contactName" className="input" placeholder="Contact name" />
          <input name="contactTitle" className="input" placeholder="Title" />
          <input name="contactEmail" className="input" placeholder="Email" type="email" />
          <input name="contactPhone" className="input" placeholder="Phone" />
        </div>
      </div>

      <button className="btn" type="submit" disabled={Boolean(selectedLocalCarrierId)}>
        Save Carrier
      </button>
    </form>
  );
}
