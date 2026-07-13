"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { documentTypes } from "@/lib/constants";
import { formatDocumentTypeLabel } from "@/lib/document-types";

export function DocumentTypePicker({
  name = "types",
  defaultTypes = []
}: {
  name?: string;
  defaultTypes?: string[];
}) {
  const [selectedTypes, setSelectedTypes] = useState<string[]>(defaultTypes);
  const [query, setQuery] = useState("");

  const suggestions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return documentTypes
      .map((type) => type)
      .filter((type) => !selectedTypes.includes(type))
      .filter((type) => !normalized || formatDocumentTypeLabel(type).toLowerCase().includes(normalized))
      .slice(0, 8);
  }, [query, selectedTypes]);

  function addType(type: string) {
    const value = type.trim();
    if (!value || selectedTypes.includes(value)) {
      return;
    }

    setSelectedTypes((current) => [...current, value]);
    setQuery("");
  }

  function removeType(type: string) {
    setSelectedTypes((current) => current.filter((item) => item !== type));
  }

  return (
    <div className="grid gap-2">
      <input type="hidden" name={name} value={JSON.stringify(selectedTypes)} />
      <div className="flex flex-wrap gap-2">
        {selectedTypes.map((type) => (
          <button
            key={type}
            type="button"
            className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white"
            onClick={() => removeType(type)}
          >
            {formatDocumentTypeLabel(type)}
            <X className="h-3 w-3" />
          </button>
        ))}
      </div>
      <input
        className="input"
        value={query}
        placeholder="Select or type a document type and press Enter"
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            addType(query);
          }
        }}
      />
      {suggestions.length ? (
        <div className="rounded-2xl border border-border bg-white p-2 shadow-card">
          {suggestions.map((type) => (
            <button
              key={type}
              type="button"
              className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-muted"
              onClick={() => addType(type)}
            >
              {formatDocumentTypeLabel(type)}
            </button>
          ))}
        </div>
      ) : null}
      <p className="muted">
        Enter the general type of document this is related to. Add custom doc types by typing the name
        and pressing Enter.
      </p>
    </div>
  );
}
