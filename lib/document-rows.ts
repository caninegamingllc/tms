import type { DocumentTableRow } from "@/components/documents-table";
import { parseDocumentTypes } from "@/lib/document-types";

type DocumentWithRelations = {
  id: string;
  name: string;
  notes: string | null;
  type: string;
  types: string | null;
  status: string;
  uploadedAt: Date;
  uploadedBy?: { name: string } | null;
  load?: { id: string; loadNumber: string } | null;
  customer?: { id: string; name: string } | null;
  carrier?: { id: string; name: string } | null;
};

export function toDocumentTableRow(document: DocumentWithRelations): DocumentTableRow {
  const types = parseDocumentTypes(document.types);

  return {
    id: document.id,
    name: document.name,
    notes: document.notes ?? "",
    type: document.type,
    types: types.length ? types : [document.type],
    linkedTo: document.load?.loadNumber ?? document.customer?.name ?? document.carrier?.name ?? "Unlinked",
    linkedHref: document.load
      ? `/loads/${document.load.id}`
      : document.customer
        ? `/customers/${document.customer.id}`
        : document.carrier
          ? `/carriers/${document.carrier.id}`
          : undefined,
    uploadSource: document.uploadedBy?.name ?? "System",
    status: document.status,
    uploadedAt: document.uploadedAt.toISOString()
  };
}

export function toDocumentTableRows(documents: DocumentWithRelations[]) {
  return documents.map(toDocumentTableRow);
}
