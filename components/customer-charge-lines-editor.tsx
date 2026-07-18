"use client";

import { useMemo, useState } from "react";
import type { CarrierPayCalculationMethod } from "@/lib/constants";
import { formatMoney } from "@/lib/format";

export type ChargeTypeOption = {
  id: string;
  name: string;
  calculationMethod: CarrierPayCalculationMethod | string;
};

export type InitialCustomerCharge = {
  lineTypeId: string;
  description?: string | null;
  unitRateCents: number;
  quantity: number;
  amountCents: number;
};

type DraftLine = {
  key: string;
  lineTypeId: string;
  description: string;
  unitRate: string;
  quantity: string;
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

function lineAmountCents(method: string, unitRateCents: number, quantity: number) {
  if (method === "PER_MILE" || method === "HOURLY") {
    return Math.round(unitRateCents * quantity);
  }
  return unitRateCents;
}

function methodLabel(method: string) {
  if (method === "PER_MILE") return "Per mile";
  if (method === "HOURLY") return "Hourly";
  return "Flat";
}

function newKey() {
  return `charge-${Math.random().toString(36).slice(2, 10)}`;
}

export function CustomerChargeLinesEditor({
  lineTypes,
  initialLines,
  defaultMiles,
  fieldName = "customerChargesJson"
}: {
  lineTypes: ChargeTypeOption[];
  initialLines?: InitialCustomerCharge[];
  defaultMiles?: number | null;
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
        quantity: String(line.quantity || 1)
      }));
    }
    return [
      {
        key: newKey(),
        lineTypeId: defaultTypeId,
        description: "",
        unitRate: "",
        quantity: defaultMiles && defaultMiles > 0 ? String(defaultMiles) : "1"
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
          } else if (method === "HOURLY" && line.quantity === String(defaultMiles ?? "")) {
            next.quantity = "1";
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
            : "1"
      }
    ]);
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((line) => line.key !== key));
  }

  const computed = lines.map((line) => {
    const method = methodFor(line.lineTypeId);
    const unitRateCents = parseMoney(line.unitRate);
    const quantity = method === "FLAT" ? 1 : parseQuantity(line.quantity);
    const amountCents = lineAmountCents(method, unitRateCents, quantity || 1);
    return { ...line, method, unitRateCents, quantity: quantity || 1, amountCents };
  });

  const totalCents = computed.reduce((sum, line) => sum + line.amountCents, 0);

  const payload = computed.map((line, index) => ({
    lineTypeId: line.lineTypeId,
    description: line.description.trim() || null,
    unitRateCents: line.unitRateCents,
    quantity: line.quantity,
    amountCents: line.amountCents,
    sortOrder: index
  }));

  if (!lineTypes.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No customer charge types configured. An admin can add them under Admin → Settings.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      <input type="hidden" name={fieldName} value={JSON.stringify(payload)} />
      <div className="grid gap-3">
        {computed.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            No charge line items. Add at least one customer rate line.
          </p>
        ) : null}
        {computed.map((line) => (
          <div
            key={line.key}
            className="grid gap-3 rounded-lg border border-border bg-card p-3"
          >
            <div className="grid gap-3 sm:grid-cols-12 sm:items-end">
              <label className="grid gap-1 sm:col-span-4">
                <span className="label">Charge type</span>
                <select
                  className="select"
                  value={line.lineTypeId}
                  onChange={(event) => updateLine(line.key, { lineTypeId: event.target.value })}
                >
                  {lineTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                      {type.calculationMethod && type.calculationMethod !== "FLAT"
                        ? ` (${methodLabel(String(type.calculationMethod))})`
                        : ""}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground">
                  Calculates as {methodLabel(line.method).toLowerCase()}
                </p>
              </label>
              {line.method === "PER_MILE" || line.method === "HOURLY" ? (
                <label className="grid gap-1 sm:col-span-2">
                  <span className="label">{line.method === "PER_MILE" ? "Miles" : "Hours"}</span>
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
              <label
                className={[
                  "grid gap-1",
                  line.method === "PER_MILE" || line.method === "HOURLY"
                    ? "sm:col-span-3"
                    : "sm:col-span-4"
                ].join(" ")}
              >
                <span className="label">
                  {line.method === "PER_MILE"
                    ? "Rate / mile"
                    : line.method === "HOURLY"
                      ? "Rate / hour"
                      : "Amount"}
                </span>
                <input
                  className="input"
                  value={line.unitRate}
                  onChange={(event) => updateLine(line.key, { unitRate: event.target.value })}
                  placeholder="0.00"
                  required
                />
              </label>
              <div
                className={[
                  "flex items-end justify-between gap-3",
                  line.method === "PER_MILE" || line.method === "HOURLY"
                    ? "sm:col-span-3"
                    : "sm:col-span-4"
                ].join(" ")}
              >
                <p className="text-sm text-muted-foreground">
                  Line:{" "}
                  <span className="font-medium text-foreground">{formatMoney(line.amountCents)}</span>
                </p>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => removeLine(line.key)}
                  disabled={computed.length <= 1}
                >
                  Remove
                </button>
              </div>
            </div>

            <label className="grid gap-1 sm:max-w-xl">
              <span className="label">Description (optional)</span>
              <input
                className="input"
                value={line.description}
                onChange={(event) => updateLine(line.key, { description: event.target.value })}
                placeholder="Notes for this line"
              />
            </label>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted px-4 py-3">
        <button type="button" className="btn-secondary" onClick={addLine}>
          Add line item
        </button>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Customer rate total
          </span>
          <span className="text-base font-semibold tabular-nums text-foreground">
            {formatMoney(totalCents)}
          </span>
        </div>
      </div>
    </div>
  );
}
