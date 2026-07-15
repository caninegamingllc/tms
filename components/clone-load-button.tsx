"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

/** Match email compose so Leaflet / chrome stay underneath. */
const CLONE_DIALOG_Z_INDEX = 10000;

export function CloneLoadButton({
  loadId,
  loadNumber
}: {
  loadId: string;
  loadNumber: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [keepCarrier, setKeepCarrier] = useState(false);
  const [keepRate, setKeepRate] = useState(true);
  const [keepCommodity, setKeepCommodity] = useState(true);
  const [keepNotes, setKeepNotes] = useState(true);

  function openDialog() {
    setKeepCarrier(false);
    setKeepRate(true);
    setKeepCommodity(true);
    setKeepNotes(true);
    setOpen(true);
  }

  function closeDialog() {
    setOpen(false);
  }

  function confirmClone() {
    const params = new URLSearchParams({
      cloneFrom: loadId,
      keepCarrier: keepCarrier ? "1" : "0",
      keepRate: keepRate ? "1" : "0",
      keepCommodity: keepCommodity ? "1" : "0",
      keepNotes: keepNotes ? "1" : "0"
    });
    setOpen(false);
    router.push(`/loads/new?${params.toString()}`);
  }

  const dialog = open ? (
    <div
      className="fixed inset-0 flex items-center justify-center bg-slate-900/50 p-4"
      style={{ zIndex: CLONE_DIALOG_Z_INDEX }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="clone-load-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-card"
      >
        <div className="mb-4">
          <h2 id="clone-load-title" className="text-lg font-semibold text-foreground">
            Clone load {loadNumber}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Customer and stops always copy. Appointment dates are cleared so you can set fresh
            dates on the create form.
          </p>
        </div>

        <div className="grid gap-3">
          <label className="flex items-start gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-border"
              checked={keepCarrier}
              onChange={(event) => setKeepCarrier(event.target.checked)}
            />
            <span>
              <span className="font-medium">Keep carrier</span>
              <span className="mt-0.5 block text-muted-foreground">
                Copy the assigned carrier and pay lines onto the new load.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-border"
              checked={keepRate}
              onChange={(event) => setKeepRate(event.target.checked)}
            />
            <span>
              <span className="font-medium">Keep rate</span>
              <span className="mt-0.5 block text-muted-foreground">
                Copy customer rate and estimated carrier cost.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-border"
              checked={keepCommodity}
              onChange={(event) => setKeepCommodity(event.target.checked)}
            />
            <span>
              <span className="font-medium">Keep commodity details</span>
              <span className="mt-0.5 block text-muted-foreground">
                Copy freight lines (description, weight, dimensions).
              </span>
            </span>
          </label>

          <label className="flex items-start gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-border"
              checked={keepNotes}
              onChange={(event) => setKeepNotes(event.target.checked)}
            />
            <span>
              <span className="font-medium">Keep notes</span>
              <span className="mt-0.5 block text-muted-foreground">
                Copy public notes only. Private notes are never cloned.
              </span>
            </span>
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={closeDialog}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={confirmClone}>
            Continue to create form
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button type="button" className="btn-secondary" onClick={openDialog}>
        Clone Load
      </button>
      {dialog && typeof document !== "undefined" ? createPortal(dialog, document.body) : null}
    </>
  );
}
