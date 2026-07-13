"use client";

import Link from "next/link";
import { SortableTable } from "@/components/sortable-table";
import { formatDate, humanize } from "@/lib/format";

export type DocumentTableRow = {
  id: string;
  name: string;
  notes: string;
  type: string;
  linkedTo: string;
  documentRef: string;
  uploadedAt: string;
};

export function DocumentsTable({ documents }: { documents: DocumentTableRow[] }) {
  return (
    <SortableTable
      data={documents}
      keyExtractor={(document) => document.id}
      defaultSort={{ columnId: "uploaded", direction: "desc" }}
      columns={[
        {
          id: "name",
          label: "Name",
          sortValue: (document) => document.name,
          render: (document) => (
            <>
              <p className="font-semibold text-foreground">{document.name}</p>
              <p className="muted">{document.notes}</p>
            </>
          )
        },
        {
          id: "type",
          label: "Type",
          sortValue: (document) => document.type,
          render: (document) => humanize(document.type)
        },
        {
          id: "linkedTo",
          label: "Linked To",
          sortValue: (document) => document.linkedTo,
          render: (document) => document.linkedTo
        },
        {
          id: "documentRef",
          label: "Document # / Path",
          sortValue: (document) => document.documentRef,
          render: (document) => document.documentRef
        },
        {
          id: "uploaded",
          label: "Uploaded",
          sortValue: (document) => document.uploadedAt,
          render: (document) => formatDate(document.uploadedAt)
        },
        {
          id: "preview",
          label: "Preview",
          sortable: false,
          render: (document) => (
            <Link href={`/documents/${document.id}`} className="font-semibold text-primary">
              Open
            </Link>
          )
        }
      ]}
    />
  );
}
