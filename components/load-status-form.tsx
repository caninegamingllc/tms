"use client";

import { FormEvent } from "react";
import { updateLoadStatus } from "@/lib/actions";
import { loadStatuses } from "@/lib/constants";
import { PENDING_REVERT_CONFIRM_MESSAGE } from "@/lib/dispatch-assignment";
import { humanize } from "@/lib/format";

export function LoadStatusForm({
  loadId,
  currentStatus,
  hasAssignments,
  hasPayLines
}: {
  loadId: string;
  currentStatus: string;
  hasAssignments: boolean;
  hasPayLines: boolean;
}) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const selected = String(new FormData(form).get("status") ?? "").trim();
    const movingToPending = selected === "QUOTE" || selected === "PENDING" || selected === "AVAILABLE";
    const willClearCoverage = movingToPending && (hasAssignments || hasPayLines);

    if (!willClearCoverage) {
      return;
    }

    const confirmed = window.confirm(PENDING_REVERT_CONFIRM_MESSAGE);
    if (!confirmed) {
      event.preventDefault();
    }
  }

  return (
    <form action={updateLoadStatus} onSubmit={handleSubmit} className="mt-4 grid gap-3">
      <input type="hidden" name="loadId" value={loadId} />
      <select key={currentStatus} name="status" className="select" defaultValue={currentStatus}>
        {loadStatuses.map((status) => (
          <option key={status} value={status}>
            {humanize(status)}
          </option>
        ))}
      </select>
      <button type="submit" className="btn">
        Update Status
      </button>
    </form>
  );
}
