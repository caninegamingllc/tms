"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, Search, X } from "lucide-react";
import type { CarrierLookupResult } from "@/lib/carrier-lookup";

/** Match the app's other portal dialogs so map/chrome stay underneath. */
const QUICK_SEARCH_Z_INDEX = 10000;

function complianceBadgeClass(status?: string) {
  switch (status) {
    case "Approved":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Blocked":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "Review Soon":
      return "bg-amber-50 text-amber-800 border-amber-200";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function addCarrierHref(result: CarrierLookupResult) {
  const params = new URLSearchParams();
  if (result.name) {
    params.set("name", result.name);
  }
  if (result.mcNumber) {
    params.set("mc", result.mcNumber);
  }
  if (result.dotNumber) {
    params.set("dot", result.dotNumber);
  }
  return `/carriers?${params.toString()}`;
}

export function CarrierQuickSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<CarrierLookupResult[]>([]);
  const [fmcsaAvailable, setFmcsaAvailable] = useState(true);
  const [searchedTerm, setSearchedTerm] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  async function runSearch(event: React.FormEvent) {
    event.preventDefault();
    const term = query.trim();

    setOpen(true);
    setSearchedTerm(term);

    if (term.length < 3) {
      setError("Enter at least 3 characters of an MC or DOT number.");
      setResults([]);
      setHasSearched(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    setHasSearched(false);

    try {
      const params = new URLSearchParams({ type: "auto", q: term });
      const response = await fetch(`/api/carriers/lookup?${params.toString()}`);

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "Carrier lookup is unavailable.");
        setResults([]);
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
      setError("Carrier lookup is unavailable.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  const modal = open ? (
    <div
      className="fixed inset-0 flex items-start justify-center bg-slate-900/50 p-4 pt-[12vh]"
      style={{ zIndex: QUICK_SEARCH_Z_INDEX }}
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="carrier-quick-search-title"
        className="max-h-[76vh] w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-card"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 id="carrier-quick-search-title" className="text-base font-semibold text-foreground">
              Carrier Quick Search
            </h2>
            {searchedTerm ? (
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                Results for &ldquo;{searchedTerm}&rdquo;
              </p>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Close"
            className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted"
            onClick={() => setOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Searching carriers...</p>
          ) : error ? (
            <p className="py-6 text-center text-sm text-rose-600">{error}</p>
          ) : results.length > 0 ? (
            <ul className="grid gap-3">
              {results.map((result) => {
                const isLocal = result.source === "local";
                const locationLine = [result.city, result.state].filter(Boolean).join(", ");
                return (
                  <li
                    key={result.id}
                    className="rounded-2xl border border-border bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">{result.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {[result.mcNumber, result.dotNumber ? `DOT ${result.dotNumber}` : null]
                            .filter(Boolean)
                            .join(" \u00b7 ") || "No authority numbers"}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                          isLocal
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : "border-sky-200 bg-sky-50 text-sky-700"
                        }`}
                      >
                        {isLocal ? "In TMS" : "FMCSA"}
                      </span>
                    </div>

                    <dl className="mt-3 grid gap-1.5 text-xs text-muted-foreground">
                      {result.address || locationLine ? (
                        <div className="flex gap-2">
                          <dt className="w-20 shrink-0 font-medium text-foreground">Address</dt>
                          <dd className="min-w-0">
                            {[result.address, locationLine, result.postalCode]
                              .filter(Boolean)
                              .join(", ")}
                          </dd>
                        </div>
                      ) : null}
                      {result.phone ? (
                        <div className="flex gap-2">
                          <dt className="w-20 shrink-0 font-medium text-foreground">Phone</dt>
                          <dd className="min-w-0">{result.phone}</dd>
                        </div>
                      ) : null}
                      {result.safetyRating ? (
                        <div className="flex gap-2">
                          <dt className="w-20 shrink-0 font-medium text-foreground">Safety</dt>
                          <dd className="min-w-0">{result.safetyRating}</dd>
                        </div>
                      ) : null}
                    </dl>

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      {result.complianceStatus ? (
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${complianceBadgeClass(
                            result.complianceStatus
                          )}`}
                        >
                          {result.complianceStatus}
                        </span>
                      ) : null}
                      {isLocal && result.carrierId ? (
                        <Link
                          href={`/carriers/${result.carrierId}`}
                          className="btn-secondary !px-3 !py-1 !text-[12px]"
                          onClick={() => setOpen(false)}
                        >
                          Open carrier
                        </Link>
                      ) : (
                        <Link
                          href={addCarrierHref(result)}
                          className="btn !px-3 !py-1 !text-[12px]"
                          onClick={() => setOpen(false)}
                        >
                          <ExternalLink className="mr-1 h-3.5 w-3.5" />
                          Add carrier
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : hasSearched ? (
            <div className="py-6 text-center">
              <p className="text-sm text-foreground">No carrier found for &ldquo;{searchedTerm}&rdquo;.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {fmcsaAvailable
                  ? "Checked your carrier network and FMCSA."
                  : "Checked your carrier network. Add FMCSA_WEB_KEY to enable federal search."}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <form onSubmit={runSearch} className="relative hidden items-center md:flex" role="search">
        <Search className="pointer-events-none absolute left-2.5 h-4 w-4 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Carrier Quick Search (MC or DOT)"
          aria-label="Carrier Quick Search"
          className="h-8 w-48 rounded-full border border-border bg-background pl-8 pr-3 text-[13px] text-foreground outline-none transition focus:w-64 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 lg:w-56 lg:focus:w-72"
        />
      </form>
      {modal && typeof document !== "undefined" ? createPortal(modal, document.body) : null}
    </>
  );
}
