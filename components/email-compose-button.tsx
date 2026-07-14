"use client";

import { useState, useTransition } from "react";
import {
  prepareEmailDraft,
  sendPreparedEmail,
  type EmailDraft,
  type EmailPurpose
} from "@/lib/email-ops-actions";

const purposeLabels: Record<EmailPurpose, string> = {
  CARRIER_RATE_CONFIRMATION: "Rate Confirmation",
  CUSTOMER_LOAD_CONFIRMATION: "Load Confirmation",
  INVOICE: "Invoice",
  BOL: "Bill of Lading",
  POD_REQUEST: "POD Request"
};

export function EmailComposeButton({
  loadId,
  purpose,
  label,
  disabled,
  className = "btn"
}: {
  loadId: string;
  purpose: EmailPurpose;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<EmailDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function openCompose() {
    setError(null);
    startTransition(async () => {
      try {
        const nextDraft = await prepareEmailDraft(loadId, purpose);
        setDraft(nextDraft);
        setOpen(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to prepare email.");
      }
    });
  }

  function closeCompose() {
    setOpen(false);
    setDraft(null);
    setError(null);
  }

  return (
    <>
      <button type="button" className={className} disabled={disabled || pending} onClick={openCompose}>
        {pending && !open ? "Preparing…" : label}
      </button>
      {error && !open ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}

      {open && draft ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="email-compose-title"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-card"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 id="email-compose-title" className="text-lg font-semibold text-foreground">
                  Preview email — {purposeLabels[draft.purpose]}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Review recipients, message, and attachments before sending for load{" "}
                  {draft.loadNumber}.
                </p>
              </div>
              <button type="button" className="btn-secondary" onClick={closeCompose}>
                Close
              </button>
            </div>

            <form action={sendPreparedEmail} className="grid gap-4">
              <input type="hidden" name="loadId" value={draft.loadId} />
              <input type="hidden" name="purpose" value={draft.purpose} />

              <label className="grid gap-2">
                <span className="label">From</span>
                <input className="input" value={draft.fromAddress} readOnly disabled />
              </label>

              <label className="grid gap-2">
                <span className="label">To</span>
                <input
                  name="to"
                  className="input"
                  type="email"
                  defaultValue={draft.to}
                  required
                />
              </label>

              <label className="grid gap-2">
                <span className="label">Subject</span>
                <input name="subject" className="input" defaultValue={draft.subject} required />
              </label>

              <label className="grid gap-2">
                <span className="label">Message</span>
                <textarea
                  name="body"
                  className="textarea"
                  rows={8}
                  defaultValue={draft.body}
                  required
                />
              </label>

              <div className="rounded-2xl border border-border bg-muted p-4">
                <p className="mb-2 text-sm font-semibold text-foreground">Attachments</p>
                {draft.primaryAttachmentName ? (
                  <p className="text-sm text-foreground">
                    PDF: <span className="font-medium">{draft.primaryAttachmentName}</span>
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">No PDF attachment for this email.</p>
                )}

                {draft.purpose === "INVOICE" ? (
                  <div className="mt-3 grid gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Supporting documents (BOL / POD)
                    </p>
                    {draft.supportingDocuments.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No customer BOL or POD uploads found on this load. Upload them on the load
                        with type BOL or POD to include them here.
                      </p>
                    ) : (
                      draft.supportingDocuments.map((document) => (
                        <label
                          key={document.id}
                          className="inline-flex items-start gap-2 text-sm text-foreground"
                        >
                          <input
                            type="checkbox"
                            name="supportingDocumentIds"
                            value={document.id}
                            defaultChecked
                            className="mt-0.5 h-4 w-4 rounded border-border"
                          />
                          <span>
                            {document.name}
                            {document.documentType ? (
                              <span className="text-muted-foreground"> · {document.documentType}</span>
                            ) : null}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" className="btn-secondary" onClick={closeCompose}>
                  Cancel
                </button>
                <button type="submit" className="btn">
                  Send email
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
