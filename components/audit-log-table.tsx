"use client";

import { SortableTable } from "@/components/sortable-table";
import { formatDateTime, humanize } from "@/lib/format";

export type AuditLogRow = {
  id: string;
  createdAt: string;
  actorEmail: string;
  action: string;
  target: string;
  details: string;
};

export function AuditLogTable({ logs }: { logs: AuditLogRow[] }) {
  return (
    <SortableTable
      tableId="audit-log"
      data={logs}
      keyExtractor={(log) => log.id}
      defaultSort={{ columnId: "time", direction: "desc" }}
      columns={[
        {
          id: "time",
          label: "Time",
          sortValue: (log) => log.createdAt,
          render: (log) => formatDateTime(log.createdAt)
        },
        {
          id: "actor",
          label: "Actor",
          sortValue: (log) => log.actorEmail,
          render: (log) => log.actorEmail
        },
        {
          id: "action",
          label: "Action",
          sortValue: (log) => log.action,
          render: (log) => <span className="font-semibold">{humanize(log.action)}</span>
        },
        {
          id: "target",
          label: "Target",
          sortValue: (log) => log.target,
          render: (log) => log.target
        },
        {
          id: "details",
          label: "Details",
          sortValue: (log) => log.details,
          render: (log) => log.details
        }
      ]}
    />
  );
}
