"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  emailCustomerInvoiceBatch,
  prepareInvoiceBatchReview
} from "@/lib/email-ops-actions";
import {
  INVOICE_BATCH_EMAIL_MAX,
  type InvoiceBatchCustomerGroup,
  type InvoiceBatchReview
} from "@/lib/invoice-batch";
import { formatDate, formatMoney } from "@/lib/format";

/** Above Leaflet panes/controls and app chrome. */
const REVIEW_Z_INDEX = 10000;

export function InvoiceBatchReview({
  open,
  invoiceIds,
  loadIds,
  onClose
}: {
  open: boolean;
  invoiceIds: string[];
  loadIds: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [review, setReview] = useState<InvoiceBatchReview | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sendNote, setSendNote] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const [sending, startSending] = useTransition();

  const group: InvoiceBatchCustomerGroup | null = review?.groups[stepIndex] ?? null;
  const totalSteps = review?.groups.length ?? 0;

  useEffect(() => {
    if (!open) {
      setReview(null);
      setStepIndex(0);
      setError(null);
      setSendNote(null);
      return;
    }
    setError(null);
    setSendNote(null);
    startLoading(async () => {
      try {
        const next = await prepareInvoiceBatchReview({ invoiceIds, loadIds });
        setReview(next);
        const first = next.groups[0];
        if (first) {
          setTo(first.to);
          setSubject(first.subject);
          setBody(first.body);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to prepare invoice batch.");
      }
    });
    // Snapshot selection when the dialog opens; ignore later array identity churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!group) {
      return;
    }
    setTo(group.to);
    setSubject(group.subject);
    setBody(group.body);
    setError(null);
    setSendNote(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, group?.customerId]);

  function finish() {
    onClose();
    router.refresh();
  }

  function goToStep(nextIndex: number) {
    if (!review || nextIndex < 0 || nextIndex >= review.groups.length) {
      return;
    }
    setStepIndex(nextIndex);
  }

  function handleSend() {
    if (!group) {
      return;
    }
    setError(null);
    setSendNote(null);
    startSending(async () => {
      try {
        const result = await emailCustomerInvoiceBatch({
          customerId: group.customerId,
          loadIds: group.lines.map((line) => line.loadId),
          to,
          subject,
          body
        });

        if (result.emailed === 0 && result.failures.length > 0) {
          setError(result.failures.slice(0, 3).join(" "));
          return;
        }

        if (result.failures.length > 0) {
          setSendNote(
            `Sent ${result.emailed}. ${result.failures.length} failed: ${result.failures
              .slice(0, 2)
              .join(" ")}`
          );
        }

        if (stepIndex + 1 >= totalSteps) {
          finish();
          return;
        }
        setStepIndex((prev) => prev + 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not send invoices.");
      }
    });
  }

  if (!open) {
    return null;
  }

  const dialog = (
    <div
      className="fixed inset-0 flex items-center justify-center bg-slate-900/50 p-4"
      style={{ zIndex: REVIEW_Z_INDEX }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="invoice-batch-review-title"
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-card"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="invoice-batch-review-title" className="text-lg font-semibold text-foreground">
              Review invoice batch
              {totalSteps > 0 ? ` — customer ${stepIndex + 1} of ${totalSteps}` : ""}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Confirm the customer, invoices, and message, then Send. Up to{" "}
              {INVOICE_BATCH_EMAIL_MAX} invoices are attached per email.
            </p>
          </div>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={sending}>
            Cancel
          </button>
        </div>

        {loading && !review ? (
          <p className="text-sm text-muted-foreground">Preparing batch…</p>
        ) : null}

        {error && !group ? <p className="text-sm font-semibold text-rose-700">{error}</p> : null}

        {group ? (
          <div className="grid gap-4">
            <div className="rounded-2xl border border-border bg-muted p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Customer
              </p>
              <p className="mt-1 text-base font-semibold text-foreground">{group.customerName}</p>
              <p className="mt-2 text-sm text-slate-700">
                {group.lines.length} invoice{group.lines.length === 1 ? "" : "s"} will be sent as{" "}
                {group.emailCount} email{group.emailCount === 1 ? "" : "s"} (max{" "}
                {INVOICE_BATCH_EMAIL_MAX} per email).
              </p>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="table min-w-full text-left text-sm">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Load / Ref</th>
                    <th>Delivery</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {group.lines.map((line) => (
                    <tr key={line.loadId}>
                      <td className="font-semibold">{line.invoiceNo}</td>
                      <td>
                        <Link href={`/loads/${line.loadId}`} className="text-primary">
                          {line.loadNumber}
                        </Link>
                        {line.referenceNumber ? (
                          <span className="block text-xs text-muted-foreground">
                            {line.referenceNumber}
                          </span>
                        ) : null}
                      </td>
                      <td>{line.deliveryAt ? formatDate(line.deliveryAt) : "—"}</td>
                      <td>{formatMoney(line.totalCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <label className="grid gap-2">
              <span className="label">From</span>
              <input className="input" value={group.fromAddress} readOnly disabled />
            </label>

            <label className="grid gap-2">
              <span className="label">To</span>
              <input
                className="input"
                type="email"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                required
                disabled={sending}
              />
            </label>

            <label className="grid gap-2">
              <span className="label">Subject</span>
              <input
                className="input"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                required
                disabled={sending}
              />
            </label>

            <label className="grid gap-2">
              <span className="label">Message</span>
              <textarea
                className="textarea"
                rows={8}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                required
                disabled={sending}
              />
            </label>

            {error ? <p className="text-sm font-semibold text-rose-700">{error}</p> : null}
            {sendNote ? <p className="text-sm font-semibold text-amber-800">{sendNote}</p> : null}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={sending || stepIndex === 0}
                  onClick={() => goToStep(stepIndex - 1)}
                >
                  Back
                </button>
                {stepIndex + 1 < totalSteps ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={sending}
                    onClick={() => goToStep(stepIndex + 1)}
                  >
                    Skip
                  </button>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-secondary" onClick={onClose} disabled={sending}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={sending || !to.trim() || !subject.trim() || !body.trim()}
                  onClick={handleSend}
                >
                  {sending
                    ? "Sending…"
                    : stepIndex + 1 < totalSteps
                      ? "Send — next customer"
                      : "Send"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(dialog, document.body);
}
