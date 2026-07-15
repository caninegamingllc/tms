"use client";

import { useState } from "react";

export type FreightLineDraft = {
  key: string;
  quantity: string;
  description: string;
  weightLbs: string;
  pieces: string;
  lengthIn: string;
  widthIn: string;
  heightIn: string;
};

export type InitialFreightLine = {
  quantity: number;
  description: string;
  weightLbs: number;
  pieces?: string | null;
  lengthIn?: number | null;
  widthIn?: number | null;
  heightIn?: number | null;
};

function newKey() {
  return `freight-${Math.random().toString(36).slice(2, 10)}`;
}

function emptyLine(): FreightLineDraft {
  return {
    key: newKey(),
    quantity: "1",
    description: "",
    weightLbs: "",
    pieces: "",
    lengthIn: "",
    widthIn: "",
    heightIn: ""
  };
}

function fromInitial(line: InitialFreightLine): FreightLineDraft {
  return {
    key: newKey(),
    quantity: String(line.quantity || 1),
    description: line.description ?? "",
    weightLbs: line.weightLbs != null ? String(line.weightLbs) : "",
    pieces: line.pieces ?? "",
    lengthIn: line.lengthIn != null ? String(line.lengthIn) : "",
    widthIn: line.widthIn != null ? String(line.widthIn) : "",
    heightIn: line.heightIn != null ? String(line.heightIn) : ""
  };
}

export function FreightLinesEditor({
  initialLines,
  descriptionSuggestions = []
}: {
  initialLines?: InitialFreightLine[];
  descriptionSuggestions?: string[];
}) {
  const [lines, setLines] = useState<FreightLineDraft[]>(() => {
    if (initialLines?.length) {
      return initialLines.map(fromInitial);
    }
    return [emptyLine()];
  });

  const datalistId = "freight-description-suggestions";

  function updateLine(key: string, patch: Partial<FreightLineDraft>) {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(key: string) {
    setLines((prev) => {
      if (prev.length <= 1) {
        return [emptyLine()];
      }
      return prev.filter((line) => line.key !== key);
    });
  }

  return (
    <div className="grid gap-3">
      {descriptionSuggestions.length ? (
        <datalist id={datalistId}>
          {descriptionSuggestions.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      ) : null}

      {lines.map((line, index) => (
        <div key={line.key} className="grid gap-3 rounded-2xl border border-border bg-muted/40 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">Line {index + 1}</p>
            <button type="button" className="btn-secondary" onClick={() => removeLine(line.key)}>
              Remove
            </button>
          </div>

          <div className="grid gap-2 md:grid-cols-[0.7fr_2fr_1fr_1fr]">
            <label className="grid gap-1">
              <span className="label">Qty</span>
              <input
                className="input"
                name="lineQuantity"
                type="number"
                min="0.01"
                step="any"
                value={line.quantity}
                onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
                required
              />
            </label>
            <label className="grid gap-1">
              <span className="label">Description</span>
              <input
                className="input"
                name="lineDescription"
                value={line.description}
                onChange={(event) => updateLine(line.key, { description: event.target.value })}
                list={descriptionSuggestions.length ? datalistId : undefined}
                placeholder="Commodity / freight description"
                required
              />
            </label>
            <label className="grid gap-1">
              <span className="label">Weight (lbs)</span>
              <input
                className="input"
                name="lineWeightLbs"
                type="number"
                min="0"
                step="1"
                value={line.weightLbs}
                onChange={(event) => updateLine(line.key, { weightLbs: event.target.value })}
                required
              />
            </label>
            <label className="grid gap-1">
              <span className="label">Pieces / Pallets</span>
              <input
                className="input"
                name="linePieces"
                value={line.pieces}
                onChange={(event) => updateLine(line.key, { pieces: event.target.value })}
                placeholder="e.g. 12 PLT"
              />
            </label>
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            <label className="grid gap-1">
              <span className="label">Length (in)</span>
              <input
                className="input"
                name="lineLengthIn"
                type="number"
                min="0"
                step="any"
                value={line.lengthIn}
                onChange={(event) => updateLine(line.key, { lengthIn: event.target.value })}
              />
            </label>
            <label className="grid gap-1">
              <span className="label">Width (in)</span>
              <input
                className="input"
                name="lineWidthIn"
                type="number"
                min="0"
                step="any"
                value={line.widthIn}
                onChange={(event) => updateLine(line.key, { widthIn: event.target.value })}
              />
            </label>
            <label className="grid gap-1">
              <span className="label">Height (in)</span>
              <input
                className="input"
                name="lineHeightIn"
                type="number"
                min="0"
                step="any"
                value={line.heightIn}
                onChange={(event) => updateLine(line.key, { heightIn: event.target.value })}
              />
            </label>
          </div>
        </div>
      ))}

      <div>
        <button type="button" className="btn-secondary" onClick={addLine}>
          Add freight line
        </button>
      </div>
    </div>
  );
}
