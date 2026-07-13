"use client";

import { FormEvent } from "react";
import { deleteLoad } from "@/lib/actions";

export function DeleteLoadButton({
  loadId,
  loadNumber
}: {
  loadId: string;
  loadNumber: string;
}) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const confirmed = window.confirm(
      `Delete load ${loadNumber}? This permanently removes the load, documents, invoices, carrier bills, and commission records.`
    );

    if (!confirmed) {
      event.preventDefault();
    }
  }

  return (
    <form action={deleteLoad} onSubmit={handleSubmit}>
      <input type="hidden" name="loadId" value={loadId} />
      <button className="btn-danger" type="submit">
        Delete Load
      </button>
    </form>
  );
}
