"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { BusinessSearchResult } from "@/lib/business-search";

type CheckCallFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  assignmentId: string;
  loadId: string;
};

type SelectedLocation = {
  label: string;
  latitude: number;
  longitude: number;
};

type PlaceLocationResult = {
  label: string;
  latitude: number;
  longitude: number;
};

function createSessionToken() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function suggestionLine(result: BusinessSearchResult) {
  return result.description || [result.address, result.city, result.state, result.postalCode].filter(Boolean).join(", ");
}

function isValidCoordinate(value: number) {
  return Number.isFinite(value);
}

function CheckCallLocationInput({
  selectedLocation,
  setSelectedLocation
}: {
  selectedLocation: SelectedLocation | null;
  setSelectedLocation: (location: SelectedLocation | null) => void;
}) {
  const [query, setQuery] = useState(selectedLocation?.label ?? "");
  const [results, setResults] = useState<BusinessSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const sessionTokenRef = useRef(createSessionToken());

  const trimmedQuery = useMemo(() => query.trim(), [query]);

  function resetSession() {
    sessionTokenRef.current = createSessionToken();
  }

  function clearSuggestions() {
    setShowSuggestions(false);
    setResults([]);
    setSearchError("");
    setLoading(false);
  }

  useEffect(() => {
    if (!showSuggestions || trimmedQuery.length < 3) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        setLoading(true);
        setSearchError("");
        const params = new URLSearchParams({
          q: trimmedQuery,
          sessionToken: sessionTokenRef.current
        });
        const response = await fetch(`/api/check-call-location?${params.toString()}`, {
          signal: controller.signal
        });

        if (!response.ok) {
          if (response.status !== 429) {
            const payload = (await response.json().catch(() => null)) as { error?: string } | null;
            setSearchError(payload?.error ?? "Location search is unavailable.");
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
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [showSuggestions, trimmedQuery]);

  async function selectResult(result: BusinessSearchResult) {
    setResults([]);
    setLoading(true);
    setSearchError("");

    try {
      const params = new URLSearchParams({
        placeId: result.id,
        sessionToken: sessionTokenRef.current
      });
      const response = await fetch(`/api/check-call-location?${params.toString()}`);

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setSearchError(payload?.error ?? "Could not resolve this location.");
        setShowSuggestions(true);
        setSelectedLocation(null);
        return;
      }

      const payload = (await response.json()) as { result?: PlaceLocationResult };
      const details = payload.result;
      if (!details || !isValidCoordinate(details.latitude) || !isValidCoordinate(details.longitude)) {
        setSearchError("Could not resolve coordinates for this location.");
        setShowSuggestions(true);
        setSelectedLocation(null);
        return;
      }

      setQuery(details.label);
      setSelectedLocation(details);
      setShowSuggestions(false);
    } finally {
      setLoading(false);
      resetSession();
    }
  }

  return (
    <label className="relative grid gap-2">
      <span className="label">Location</span>
      <input
        className="input"
        placeholder="Search city or place..."
        required
        value={query}
        autoComplete="off"
        aria-describedby="check-call-location-help"
        onChange={(event) => {
          const nextValue = event.target.value;
          setQuery(nextValue);
          setSelectedLocation(null);
          setSearchError("");
          setShowSuggestions(true);
          if (nextValue.trim().length < 3) {
            clearSuggestions();
            resetSession();
          }
        }}
        onBlur={() => {
          window.setTimeout(() => {
            setShowSuggestions(false);
          }, 150);
        }}
      />
      <input type="hidden" name="location" value={selectedLocation?.label ?? ""} />
      <input type="hidden" name="latitude" value={selectedLocation?.latitude ?? ""} />
      <input type="hidden" name="longitude" value={selectedLocation?.longitude ?? ""} />
      <p id="check-call-location-help" className="text-xs text-muted-foreground">
        Select a Google location so this check call can move the load pin.
      </p>
      {showSuggestions && trimmedQuery.length >= 3 && (results.length > 0 || loading || searchError) ? (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-2xl border border-border bg-white shadow-card">
          {loading ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">Searching locations...</p>
          ) : searchError ? (
            <p className="px-4 py-3 text-sm text-red-600">{searchError}</p>
          ) : (
            results.map((result) => (
              <button
                key={result.id}
                type="button"
                className="block w-full px-4 py-3 text-left text-sm transition hover:bg-muted"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectResult(result)}
              >
                <span className="font-semibold text-foreground">{result.name}</span>
                {suggestionLine(result) ? (
                  <span className="block text-xs text-muted-foreground">{suggestionLine(result)}</span>
                ) : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </label>
  );
}

export function CheckCallForm({ action, assignmentId, loadId }: CheckCallFormProps) {
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);
  const [scheduleNextCheckCall, setScheduleNextCheckCall] = useState(false);

  return (
    <form action={action} className="mt-4 grid gap-3 rounded-2xl bg-muted p-4">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <input type="hidden" name="loadId" value={loadId} />
      <CheckCallLocationInput
        selectedLocation={selectedLocation}
        setSelectedLocation={setSelectedLocation}
      />
      <input name="status" className="input" placeholder="Status update" required />
      <textarea name="notes" className="textarea" placeholder="Notes" rows={3} />
      <label className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-border accent-primary"
          checked={scheduleNextCheckCall}
          onChange={(event) => setScheduleNextCheckCall(event.target.checked)}
        />
        Set Next Check Call
      </label>
      {scheduleNextCheckCall ? (
        <div className="grid gap-3 rounded-xl border border-border bg-card p-3">
          <label className="grid gap-2">
            <span className="label">Next check call date/time</span>
            <input name="nextCheckAt" className="input" type="datetime-local" required />
          </label>
          <label className="grid gap-2">
            <span className="label">Next check notes</span>
            <textarea
              name="nextCheckNotes"
              className="textarea"
              placeholder="What this check call is for"
              rows={2}
            />
          </label>
        </div>
      ) : null}
      <button className="btn" type="submit" disabled={!selectedLocation}>
        Add Check Call
      </button>
    </form>
  );
}
