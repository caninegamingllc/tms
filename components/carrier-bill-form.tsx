"use client";

import { useMemo, useState } from "react";
import { DatePicker } from "@/components/ui/date-picker";
import { formatMoney } from "@/lib/format";
import { formatLocalDate, parseLocalDate } from "@/lib/dates";
import type { CarrierBillFormValues } from "@/lib/carrier-bill-form";

function addDays(isoDate: string, days: number) {
  if (!isoDate) {
    return "";
  }
  const date = parseLocalDate(isoDate);
  if (!date) {
    return "";
  }
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
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
  const openAdvances = initial.openAdvances ?? [];
  const [selectedAdvanceIds, setSelectedAdvanceIds] = useState<Set<string>>(
    () => new Set(openAdvances.map((advance) => advance.id))
  );

  const selectedTotalCents = useMemo(() => {
    return initial.lineItems
      .filter((line) => selectedLineIds.has(line.id))
      .reduce((sum, line) => sum + line.amountCents, 0);
  }, [initial.lineItems, selectedLineIds]);

  const advancesAppliedCents = useMemo(() => {
    return openAdvances
      .filter((advance) => selectedAdvanceIds.has(advance.id))
      .reduce((sum, advance) => sum + advance.remainingCents, 0);
  }, [openAdvances, selectedAdvanceIds]);

  const grossCents = amountTouched
    ? Math.round(Number(amountOverride.replace(/[^0-9.-]/g, "") || 0) * 100)
    : selectedTotalCents > 0
      ? selectedTotalCents
      : initial.totalCents;

  const netOwedCents = Math.max(0, grossCents - advancesAppliedCents);

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

  function toggleAdvance(id: string) {
    setSelectedAdvanceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
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
          <DatePicker
            name="receivedAt"
            value={receivedAt}
            onChange={onBillDateChange}
            required
            placeholder="Bill date"
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

      {openAdvances.length > 0 ? (
        <div>
          <p className="label mb-2">Apply open advances</p>
          <p className="muted mb-3">
            Selected advances reduce the amount owed on this bill.
          </p>
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-3" />
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Issued</th>
                  <th className="px-3 py-3">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {openAdvances.map((advance) => (
                  <tr key={advance.id} className="border-b border-border">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        name="advanceIds"
                        value={advance.id}
                        checked={selectedAdvanceIds.has(advance.id)}
                        onChange={() => toggleAdvance(advance.id)}
                      />
                    </td>
                    <td className="px-3 py-3">
                      {advance.advanceType}
                      {advance.reference ? ` · ${advance.reference}` : ""}
                    </td>
                    <td className="px-3 py-3">{advance.issuedAt}</td>
                    <td className="px-3 py-3 font-semibold">
                      {formatMoney(advance.remainingCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm">
            Gross bill {formatMoney(grossCents)} − advances {formatMoney(advancesAppliedCents)} ={" "}
            <span className="font-semibold">net owed {formatMoney(netOwedCents)}</span>
          </p>
        </div>
      ) : null}

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
          <DatePicker name="dueAt" value={dueAt} onChange={setDueAt} placeholder="Due date" />
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
