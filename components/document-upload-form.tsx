"use client";

import { DocumentTypePicker } from "@/components/document-type-picker";
import { EntityAttachPicker } from "@/components/entity-attach-picker";
import type { SearchOption } from "@/components/search-combobox";
import { uploadDocument } from "@/lib/actions";

export function DocumentUploadForm({
  loads = [],
  customers = [],
  carriers = [],
  defaultLoadId,
  defaultCustomerId,
  defaultCarrierId,
  showEntityPickers = true,
  showLoads = true,
  showCustomers = true,
  showCarriers = true,
  redirectTo,
  submitLabel = "Upload Document"
}: {
  loads?: SearchOption[];
  customers?: SearchOption[];
  carriers?: SearchOption[];
  defaultLoadId?: string;
  defaultCustomerId?: string;
  defaultCarrierId?: string;
  showEntityPickers?: boolean;
  showLoads?: boolean;
  showCustomers?: boolean;
  showCarriers?: boolean;
  redirectTo?: string;
  submitLabel?: string;
}) {
  return (
    <form action={uploadDocument} className="grid gap-4" encType="multipart/form-data">
      {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}
      {defaultLoadId ? <input type="hidden" name="loadId" value={defaultLoadId} /> : null}
      {defaultCustomerId ? <input type="hidden" name="customerId" value={defaultCustomerId} /> : null}
      {defaultCarrierId ? <input type="hidden" name="carrierId" value={defaultCarrierId} /> : null}

      <label className="grid gap-2">
        <span className="label">Document File</span>
        <input name="file" className="input" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" required />
      </label>

      <label className="grid gap-2">
        <span className="label">Document Name</span>
        <input
          name="name"
          className="input"
          placeholder="Optional display name (defaults to file name)"
        />
      </label>

      <label className="grid gap-2">
        <span className="label">Document Type(s)</span>
        <DocumentTypePicker />
        {defaultLoadId && defaultCustomerId ? (
          <p className="text-xs text-muted-foreground">
            For invoice supporting docs, choose <strong>BOL</strong> or <strong>POD</strong>. This
            upload is linked to the load&apos;s customer automatically.
          </p>
        ) : null}
      </label>

      <label className="grid gap-2">
        <span className="label">Description</span>
        <textarea
          name="notes"
          className="textarea"
          rows={4}
          placeholder="Internal notes about this document and how it is used."
        />
      </label>

      <label className="inline-flex items-center gap-2 text-sm text-foreground">
        <input type="checkbox" name="isCompanyDocument" className="h-4 w-4 rounded border-border" />
        Mark as a company document
      </label>

      {showEntityPickers ? (
        <div className="rounded-2xl bg-muted p-4">
          <p className="mb-3 text-sm font-semibold text-foreground">Attach This Document</p>
          <EntityAttachPicker
            loads={loads}
            customers={customers}
            carriers={carriers}
            defaultLoadId={defaultLoadId}
            defaultCustomerId={defaultCustomerId}
            defaultCarrierId={defaultCarrierId}
            showLoads={showLoads && !defaultLoadId}
            showCustomers={showCustomers && !defaultCustomerId}
            showCarriers={showCarriers && !defaultCarrierId}
          />
        </div>
      ) : null}

      <button className="btn" type="submit">
        {submitLabel}
      </button>
    </form>
  );
}
