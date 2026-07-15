"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SortableTable } from "@/components/sortable-table";
import { formatDate, humanize } from "@/lib/format";
import { formatDocumentTypeLabel } from "@/lib/document-types";

export type DocumentTableRow = {
  id: string;
  name: string;
  notes: string;
  type: string;
  types: string[];
  linkedTo: string;
  linkedHref?: string;
  uploadSource: string;
  status: string;
  uploadedAt: string;
};

export function DocumentsTable({
  documents,
  showFilter = true,
  compact = false
}: {
  documents: DocumentTableRow[];
  showFilter?: boolean;
  compact?: boolean;
}) {
  const [filter, setFilter] = useState("");

  const filteredDocuments = useMemo(() => {
    const normalized = filter.trim().toLowerCase();
    if (!normalized) {
      return documents;
    }

    return documents.filter((document) =>
      [
        document.name,
        document.notes,
        document.type,
        document.types.join(" "),
        document.linkedTo,
        document.uploadSource,
        document.status
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }, [documents, filter]);

  return (
    <div className="grid gap-4">
      {showFilter ? (
        <div className="px-5 pt-5">
          <input
            className="input"
            placeholder="Filter the document list"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <SortableTable
          tableId="documents"
          data={filteredDocuments}
          keyExtractor={(document) => document.id}
          defaultSort={{ columnId: "uploaded", direction: "desc" }}
          emptyMessage="No documents found."
          columns={[
            {
              id: "name",
              label: "Document Name",
              sortValue: (document) => document.name,
              render: (document) => (
                <>
                  <p className="font-semibold text-foreground">{document.name}</p>
                  {!compact && document.notes ? <p className="muted">{document.notes}</p> : null}
                </>
              )
            },
            {
              id: "uploadSource",
              label: "Upload Source",
              sortValue: (document) => document.uploadSource,
              render: (document) => document.uploadSource
            },
            {
              id: "uploaded",
              label: "Upload Date",
              sortValue: (document) => document.uploadedAt,
              render: (document) => formatDate(document.uploadedAt)
            },
            {
              id: "notes",
              label: "Description",
              sortValue: (document) => document.notes,
              render: (document) => document.notes || "—"
            },
            {
              id: "linkedTo",
              label: "Attached To",
              sortValue: (document) => document.linkedTo,
              render: (document) =>
                document.linkedHref ? (
                  <Link href={document.linkedHref} className="font-semibold text-primary">
                    {document.linkedTo}
                  </Link>
                ) : (
                  document.linkedTo
                )
            },
            {
              id: "types",
              label: "Document Types",
              sortValue: (document) => document.types.join(", "),
              render: (document) => (
                <div className="flex flex-wrap gap-1">
                  {(document.types.length ? document.types : [document.type]).map((type) => (
                    <span
                      key={type}
                      className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-white"
                    >
                      {formatDocumentTypeLabel(type)}
                    </span>
                  ))}
                </div>
              )
            },
            {
              id: "status",
              label: "Status",
              sortValue: (document) => document.status,
              render: (document) => humanize(document.status)
            },
            {
              id: "preview",
              label: "Open",
              sortable: false,
              render: (document) => (
                <Link href={`/documents/${document.id}`} className="font-semibold text-primary">
                  Open
                </Link>
              )
            }
          ]}
        />
      </div>
    </div>
  );
}
