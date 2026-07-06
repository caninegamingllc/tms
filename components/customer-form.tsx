"use client";

import { useEffect, useMemo, useState } from "react";
import type { BusinessSearchResult } from "@/lib/business-search";

type CustomerFormProps = {
  action: (formData: FormData) => void | Promise<void>;
};

export function CustomerForm({ action }: CustomerFormProps) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [results, setResults] = useState<BusinessSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const trimmedName = useMemo(() => name.trim(), [name]);

  useEffect(() => {
    if (trimmedName.length < 3) {
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({ q: trimmedName });
        const response = await fetch(`/api/business-search?${params.toString()}`, {
          signal: controller.signal
        });

        if (!response.ok) {
          setResults([]);
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
    }, 300);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [trimmedName]);

  function selectResult(result: BusinessSearchResult) {
    setName(result.name);
    setAddress(result.address);
    setCity(result.city);
    setState(result.state);
    setPostalCode(result.postalCode);
    setResults([]);
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
            if (nextValue.trim().length < 3) {
              setResults([]);
              setLoading(false);
            }
          }}
          autoComplete="off"
        />
        {trimmedName.length >= 3 && (results.length > 0 || loading) ? (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-2xl border border-border bg-white shadow-card">
            {loading ? (
              <p className="px-4 py-3 text-sm text-muted">Searching businesses...</p>
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
        <p className="text-xs text-muted">Business suggestions powered by OpenStreetMap.</p>
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
