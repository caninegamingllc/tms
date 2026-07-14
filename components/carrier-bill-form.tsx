"use client";

import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/format";
import type { CarrierBillFormValues } from "@/lib/carrier-bill-form";

function addDays(isoDate: string, days: number) {
  if (!isoDate) {
    return "";
  }
  const date = new Date(`${isoDate}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function CarrierBillForm({
  action,
  initial,
  submitLabel = "Save Bill"
}: {
  action: (formData: FormData) => void | Promise<void>;
  initial: CarrierBillFormValues;
  submitLabel?: string;
}) {
  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(
    () => new Set(initial.lineItems.map((line) => line.id))
  );
  const [amountOverride, setAmountOverride] = useState((initial.totalCents / 100).toFixed(2));
  const [receivedAt, setReceivedAt] = useState(initial.receivedAt);
  const [termsDays, setTermsDays] = useState(String(initial.paymentTermsDays));
  const [dueAt, setDueAt] = useState(initial.dueAt);
  const [amountTouched, setAmountTouched] = useState(Boolean(initial.billId));

  const selectedTotalCents = useMemo(() => {
    return initial.lineItems
      .filter((line) => selectedLineIds.has(line.id))
      .reduce((sum, line) => sum + line.amountCents, 0);
  }, [initial.lineItems, selectedLineIds]);

  const displayAmount = amountTouched
    ? amountOverride
    : selectedTotalCents > 0
      ? (selectedTotalCents / 100).toFixed(2)
      : amountOverride;

  function toggleLine(id: string) {
    setSelectedLineIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setAmountTouched(false);
  }

  function onTermsChange(value: string) {
    setTermsDays(value);
    const days = Number(value);
    if (receivedAt && Number.isFinite(days)) {
      setDueAt(addDays(receivedAt, days));
    }
  }

  function onBillDateChange(value: string) {
    setReceivedAt(value);
    const days = Number(termsDays);
    if (value && Number.isFinite(days)) {
      setDueAt(addDays(value, days));
    }
  }

  return (
    <form action={action} className="grid gap-5">
      {initial.billId ? <input type="hidden" name="billId" value={initial.billId} /> : null}
      <input type="hidden" name="loadId" value={initial.loadId} />
      <input type="hidden" name="carrierId" value={initial.carrierId} />
      <input type="hidden" name="billNo" value={initial.billNo} />
      <input type="hidden" name="payeeName" value={initial.payeeName} />
      <input type="hidden" name="status" value={initial.status} />
      {[...selectedLineIds].map((id) => (
        <input key={id} type="hidden" name="selectedLineIds" value={id} />
      ))}

      <div className="rounded-2xl border border-border bg-muted/30 p-4 text-sm">
        <p className="font-semibold text-foreground">
          {initial.carrierName} · Load {initial.loadNumber}
        </p>
        <p className="muted mt-1">Internal bill # {initial.billNo}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="label">Remit To Address</span>
          <textarea
            name="remitAddress"
            className="input min-h-[88px]"
            defaultValue={initial.remitAddress}
            placeholder="Payment remittance address"
          />
        </label>
        <label className="grid gap-2">
          <span className="label">Checks Payable To</span>
          <input
            name="nameOnCheck"
            className="input"
            defaultValue={initial.nameOnCheck}
            required
            placeholder="Name printed on check / QuickBooks payee"
          />
          <span className="text-xs text-muted-foreground">Default payee: {initial.payeeName}</span>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="label">Bill Date</span>
          <input
            name="receivedAt"
            className="input"
            type="date"
            value={receivedAt}
            onChange={(event) => onBillDateChange(event.target.value)}
            required
          />
        </label>
        <label className="grid gap-2">
          <span className="label">Bill Amount (USD)</span>
          <input
            name="total"
            className="input"
            value={displayAmount}
            onChange={(event) => {
              setAmountTouched(true);
              setAmountOverride(event.target.value);
            }}
            required
          />
        </label>
      </div>

      <div>
        <p className="label mb-2">Load Pay Lines</p>
        <p className="muted mb-3">
          Select line items included on this carrier invoice. The bill amount defaults to the selected total.
        </p>
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-3" />
                <th className="px-3 py-3">Description</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Rate</th>
                <th className="px-3 py-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {initial.lineItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                    No carrier pay lines on this load. Enter the bill amount manually.
                  </td>
                </tr>
              ) : (
                initial.lineItems.map((line) => (
                  <tr key={line.id} className="border-b border-border">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedLineIds.has(line.id)}
                        onChange={() => toggleLine(line.id)}
                      />
                    </td>
                    <td className="px-3 py-3">{line.description}</td>
                    <td className="px-3 py-3">{line.type}</td>
                    <td className="px-3 py-3">{formatMoney(line.rateCents)}</td>
                    <td className="px-3 py-3 font-semibold">{formatMoney(line.amountCents)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="grid gap-2">
          <span className="label">Bill Reference Number</span>
          <input
            name="billReference"
            className="input"
            defaultValue={initial.billReference}
            placeholder="Carrier / factor invoice #"
          />
        </label>
        <label className="grid gap-2">
          <span className="label">Payment Terms (days)</span>
          <input
            name="paymentTermsDays"
            className="input"
            type="number"
            min={0}
            value={termsDays}
            onChange={(event) => onTermsChange(event.target.value)}
          />
        </label>
        <label className="grid gap-2">
          <span className="label">Due Date</span>
          <input
            name="dueAt"
            className="input"
            type="date"
            value={dueAt}
            onChange={(event) => setDueAt(event.target.value)}
          />
        </label>
        <label className="grid gap-2">
          <span className="label">Payment Method</span>
          <select name="paymentMethod" className="select" defaultValue={initial.paymentMethod || "CHECK"}>
            <option value="CHECK">Check</option>
            <option value="ACH">ACH</option>
            <option value="WIRE">Wire</option>
            <option value="FACTOR">Factor</option>
            <option value="OTHER">Other</option>
          </select>
          <span className="text-xs text-muted-foreground">
            If factoring, select the preferred payment method for this vendor.
          </span>
        </label>
      </div>

      <label className="grid gap-2">
        <span className="label">Bill Notes</span>
        <textarea
          name="notes"
          className="input min-h-[96px]"
          defaultValue={initial.notes}
          placeholder="Bill notes..."
        />
      </label>

      <button type="submit" className="btn w-fit">
        {submitLabel}
      </button>
    </form>
  );
}
