"use client";

import { useMemo, useState } from "react";
import type { DriverPayCalculationMethod } from "@/lib/constants";
import { formatMoney } from "@/lib/format";

export type DriverPayLineTypeOption = {
  id: string;
  name: string;
  calculationMethod: DriverPayCalculationMethod | string;
};

export type InitialDriverPayLine = {
  lineTypeId: string;
  description?: string | null;
  unitRateCents: number;
  quantity: number;
  percent?: number | null;
  amountCents: number;
};

type DraftLine = {
  key: string;
  lineTypeId: string;
  description: string;
  unitRate: string;
  quantity: string;
  percent: string;
};

function moneyToInput(cents: number) {
  if (!cents) return "";
  return (cents / 100).toFixed(2).replace(/\.00$/, "");
}

function parseMoney(value: string) {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (!cleaned) return 0;
  const num = Number(cleaned);
  return Number.isFinite(num) ? Math.round(num * 100) : 0;
}

function parseQuantity(value: string) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

function lineAmountCents(
  method: string,
  unitRateCents: number,
  quantity: number,
  percent: number,
  eligibleRevenueCents: number
) {
  if (method === "PER_MILE") {
    return Math.round(unitRateCents * quantity);
  }
  if (method === "PERCENT_REVENUE") {
    return Math.round((eligibleRevenueCents * percent) / 100);
  }
  return unitRateCents;
}

function newKey() {
  return `dpl-${Math.random().toString(36).slice(2, 10)}`;
}

export function DriverPayLinesEditor({
  lineTypes,
  initialLines,
  defaultMiles,
  eligibleRevenueCents = 0,
  fieldName = "driverPayLinesJson"
}: {
  lineTypes: DriverPayLineTypeOption[];
  initialLines?: InitialDriverPayLine[];
  defaultMiles?: number | null;
  eligibleRevenueCents?: number;
  fieldName?: string;
}) {
  const typeById = useMemo(
    () => new Map(lineTypes.map((type) => [type.id, type])),
    [lineTypes]
  );

  const defaultTypeId = lineTypes[0]?.id ?? "";

  const [lines, setLines] = useState<DraftLine[]>(() => {
    if (initialLines?.length) {
      return initialLines.map((line) => ({
        key: newKey(),
        lineTypeId: line.lineTypeId,
        description: line.description ?? "",
        unitRate: moneyToInput(line.unitRateCents),
        quantity: String(line.quantity || 1),
        percent: line.percent != null ? String(line.percent) : ""
      }));
    }
    return [
      {
        key: newKey(),
        lineTypeId: defaultTypeId,
        description: "",
        unitRate: "",
        quantity: defaultMiles && defaultMiles > 0 ? String(defaultMiles) : "1",
        percent: ""
      }
    ];
  });

  function methodFor(lineTypeId: string) {
    return typeById.get(lineTypeId)?.calculationMethod ?? "FLAT";
  }

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((prev) =>
      prev.map((line) => {
        if (line.key !== key) return line;
        const next = { ...line, ...patch };
        if (patch.lineTypeId && patch.lineTypeId !== line.lineTypeId) {
          const method = methodFor(patch.lineTypeId);
          if (method === "PER_MILE" && defaultMiles && defaultMiles > 0) {
            next.quantity = String(defaultMiles);
          } else if (method === "FLAT") {
            next.quantity = "1";
          } else if (method === "PERCENT_REVENUE") {
            next.unitRate = "";
          }
        }
        return next;
      })
    );
  }

  function addLine() {
    setLines((prev) => [
      ...prev,
      {
        key: newKey(),
        lineTypeId: defaultTypeId,
        description: "",
        unitRate: "",
        quantity:
          methodFor(defaultTypeId) === "PER_MILE" && defaultMiles && defaultMiles > 0
            ? String(defaultMiles)
            : "1",
        percent: ""
      }
    ]);
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((line) => line.key !== key));
  }

  const computed = lines.map((line) => {
    const method = methodFor(line.lineTypeId);
    const unitRateCents = parseMoney(line.unitRate);
    const quantity = method === "PER_MILE" ? parseQuantity(line.quantity) : 1;
    const percent = Number(line.percent) || 0;
    const amountCents = lineAmountCents(
      method,
      unitRateCents,
      quantity || 1,
      percent,
      eligibleRevenueCents
    );
    return { ...line, method, unitRateCents, quantity: quantity || 1, percent, amountCents };
  });

  const totalCents = computed.reduce((sum, line) => sum + line.amountCents, 0);

  const payload = computed.map((line, index) => ({
    lineTypeId: line.lineTypeId,
    description: line.description.trim() || null,
    unitRateCents: line.unitRateCents,
    quantity: line.quantity,
    percent: line.method === "PERCENT_REVENUE" ? line.percent : null,
    amountCents: line.amountCents,
    sortOrder: index
  }));

  if (!lineTypes.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No driver pay line types configured. An admin can add them under Admin → Settings.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      <input type="hidden" name={fieldName} value={JSON.stringify(payload)} />
      {eligibleRevenueCents > 0 ? (
        <p className="text-xs text-muted-foreground">
          Eligible revenue for % pay: {formatMoney(eligibleRevenueCents)} (excludes charge types
          marked out of driver pay)
        </p>
      ) : null}
      <div className="grid gap-3">
        {computed.map((line) => (
          <div
            key={line.key}
            className="grid gap-2 rounded-2xl border border-border bg-muted/40 p-3"
          >
            <div className="grid gap-2 md:grid-cols-[1.4fr_1fr_auto]">
              <label className="grid gap-1">
                <span className="label">Type</span>
                <select
                  className="select"
                  value={line.lineTypeId}
                  onChange={(event) => updateLine(line.key, { lineTypeId: event.target.value })}
                >
                  {lineTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </label>
              {line.method === "PERCENT_REVENUE" ? (
                <label className="grid gap-1">
                  <span className="label">Percent of revenue</span>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={line.percent}
                    onChange={(event) => updateLine(line.key, { percent: event.target.value })}
                    placeholder="65"
                    required
                  />
                </label>
              ) : (
                <label className="grid gap-1">
                  <span className="label">
                    {line.method === "PER_MILE" ? "Rate / mile" : "Amount"}
                  </span>
                  <input
                    className="input"
                    value={line.unitRate}
                    onChange={(event) => updateLine(line.key, { unitRate: event.target.value })}
                    placeholder="0.00"
                    required
                  />
                </label>
              )}
              <div className="flex items-end">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => removeLine(line.key)}
                >
                  Remove
                </button>
              </div>
            </div>

            {line.method === "PER_MILE" ? (
              <label className="grid gap-1 max-w-xs">
                <span className="label">Miles</span>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.quantity}
                  onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
                  required
                />
              </label>
            ) : null}

            <label className="grid gap-1">
              <span className="label">Description (optional)</span>
              <input
                className="input"
                value={line.description}
                onChange={(event) => updateLine(line.key, { description: event.target.value })}
                placeholder="Notes for this line"
              />
            </label>

            <p className="text-sm text-muted-foreground">
              Line total:{" "}
              <span className="font-medium text-foreground">{formatMoney(line.amountCents)}</span>
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" className="btn-secondary" onClick={addLine}>
          Add line item
        </button>
        <p className="text-sm font-semibold text-foreground">
          Driver pay total: {formatMoney(totalCents)}
        </p>
      </div>
    </div>
  );
}
