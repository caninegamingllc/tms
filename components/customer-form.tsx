"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { BusinessSearchResult } from "@/lib/business-search";

type BranchOption = { id: string; name: string };

type CustomerFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  branches?: BranchOption[];
  showBranchPicker?: boolean;
};

function createSessionToken() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function CustomerForm({ action, branches = [], showBranchPicker = false }: CustomerFormProps) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [results, setResults] = useState<BusinessSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const sessionTokenRef = useRef(createSessionToken());

  const trimmedName = useMemo(() => name.trim(), [name]);

  useEffect(() => {
    if (trimmedName.length < 3) {
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        setLoading(true);
        setSearchError("");
        const params = new URLSearchParams({
          q: trimmedName,
          sessionToken: sessionTokenRef.current
        });
        const response = await fetch(`/api/business-search?${params.toString()}`, {
          signal: controller.signal
        });

        if (!response.ok) {
          if (response.status !== 429) {
            const payload = (await response.json().catch(() => null)) as { error?: string } | null;
            setSearchError(payload?.error ?? "Business search is unavailable.");
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
  }, [trimmedName]);

  async function selectResult(result: BusinessSearchResult) {
    setResults([]);
    setLoading(true);
    setSearchError("");

    try {
      const params = new URLSearchParams({
        placeId: result.id,
        name: result.name,
        sessionToken: sessionTokenRef.current
      });
      const response = await fetch(`/api/business-search?${params.toString()}`);

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setSearchError(payload?.error ?? "Could not load business details.");
        setName(result.name);
        return;
      }

      const payload = (await response.json()) as { result?: BusinessSearchResult };
      const details = payload.result;
      if (!details) {
        setName(result.name);
        return;
      }

      setName(details.name || result.name);
      setAddress(details.address);
      setCity(details.city);
      setState(details.state);
      setPostalCode(details.postalCode);
    } finally {
      setLoading(false);
      sessionTokenRef.current = createSessionToken();
    }
  }

  return (
    <form action={action} className="mt-4 grid gap-3">
      <label className="relative grid gap-2">
        <span className="label">Customer name</span>
        <input
          name="name"
          className="input"
          placeholder="Customer name"
          required
          value={name}
          onChange={(event) => {
            const nextValue = event.target.value;
            setName(nextValue);
            setSearchError("");
            if (nextValue.trim().length < 3) {
              setResults([]);
              setLoading(false);
              sessionTokenRef.current = createSessionToken();
            }
          }}
          autoComplete="off"
        />
        {trimmedName.length >= 3 && (results.length > 0 || loading || searchError) ? (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-2xl border border-border bg-white shadow-card">
            {loading ? (
              <p className="px-4 py-3 text-sm text-muted">Searching businesses...</p>
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
                  {result.description ? (
                    <span className="block text-xs text-muted">{result.description}</span>
                  ) : null}
                </button>
              ))
            )}
          </div>
        ) : null}
        <p className="text-xs text-muted">Business suggestions powered by Google.</p>
      </label>
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
        <input name="phone" className="input" placeholder="Main phone" />
        <input name="email" className="input" placeholder="Main email" type="email" />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <input name="industry" className="input" placeholder="Industry" />
        <select name="status" className="select" defaultValue="Active">
          <option>Active</option>
          <option>Prospect</option>
          <option>Credit Hold</option>
          <option>Inactive</option>
        </select>
      </div>
      {showBranchPicker ? (
        <label className="grid gap-2">
          <span className="label">Branch</span>
          <select name="branchId" className="select" defaultValue="">
            <option value="">Default to your branch</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        <input name="creditLimit" className="input" placeholder="Credit limit" />
        <input name="paymentTerms" className="input" defaultValue="Net 30" />
      </div>
      <div className="rounded-2xl bg-soft p-4">
        <p className="mb-3 text-sm font-semibold text-ink">Primary Contact</p>
        <div className="grid gap-3">
          <input name="contactName" className="input" placeholder="Contact name" />
          <input name="contactTitle" className="input" placeholder="Title" />
          <input name="contactEmail" className="input" placeholder="Email" type="email" />
          <input name="contactPhone" className="input" placeholder="Phone" />
        </div>
      </div>
      <button className="btn" type="submit">
        Save Customer
      </button>
    </form>
  );
}
