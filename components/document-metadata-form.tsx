"use client";

import { DocumentTypePicker } from "@/components/document-type-picker";
import { EntityAttachPicker } from "@/components/entity-attach-picker";
import type { SearchOption } from "@/components/search-combobox";
import { deleteDocument, updateDocument } from "@/lib/actions";

export function DocumentMetadataForm({
  documentId,
  defaultName,
  defaultNotes,
  defaultTypes,
  defaultLoadId,
  defaultCustomerId,
  defaultCarrierId,
  defaultIsCompanyDocument,
  loads,
  customers,
  carriers,
  returnTo = "/documents"
}: {
  documentId: string;
  defaultName: string;
  defaultNotes?: string | null;
  defaultTypes: string[];
  defaultLoadId?: string;
  defaultCustomerId?: string;
  defaultCarrierId?: string;
  defaultIsCompanyDocument?: boolean;
  loads: SearchOption[];
  customers: SearchOption[];
  carriers: SearchOption[];
  returnTo?: string;
}) {
  return (
    <div className="grid gap-5">
      <form action={updateDocument} className="grid gap-4" encType="multipart/form-data">
        <input type="hidden" name="documentId" value={documentId} />

        <EntityAttachPicker
          loads={loads}
          customers={customers}
          carriers={carriers}
          defaultLoadId={defaultLoadId}
          defaultCustomerId={defaultCustomerId}
          defaultCarrierId={defaultCarrierId}
        />

        <label className="grid gap-2">
          <span className="label">Document Name</span>
          <input name="name" className="input" defaultValue={defaultName} required />
          <p className="muted">Change this only if you want an easy to read document name.</p>
        </label>

        <label className="grid gap-2">
          <span className="label">Document Type(s)</span>
          <DocumentTypePicker defaultTypes={defaultTypes} />
        </label>

        <label className="grid gap-2">
          <span className="label">Full Description Of This Document And Uses</span>
          <textarea
            name="notes"
            className="textarea"
            rows={5}
            defaultValue={defaultNotes ?? ""}
            placeholder="Use this for internal notes about this document."
          />
        </label>

        <label className="inline-flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            name="isCompanyDocument"
            className="h-4 w-4 rounded border-border"
            defaultChecked={defaultIsCompanyDocument}
          />
          Mark as a company document
        </label>

        <label className="grid gap-2">
          <span className="label">Replace File</span>
          <input name="file" className="input" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" />
        </label>

        <div className="flex flex-wrap gap-3">
          <button className="btn" type="submit">
            Save doc
          </button>
        </div>
      </form>

      <form action={deleteDocument}>
        <input type="hidden" name="documentId" value={documentId} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <button className="btn-danger" type="submit">
          Delete doc
        </button>
      </form>
    </div>
  );
}
