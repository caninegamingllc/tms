"use client";

import { useMemo, useState } from "react";
import { SortableTable } from "@/components/sortable-table";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTime } from "@/lib/format";
import type { AdminUserRow } from "@/components/admin-user-editor";

export function AdminUsersTable({
  rows,
  selectedMembershipId,
  onSelect
}: {
  rows: AdminUserRow[];
  selectedMembershipId: string | null;
  onSelect: (membershipId: string) => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return rows;
    }

    return rows.filter((row) => {
      return (
        row.userName.toLowerCase().includes(query) ||
        row.userEmail.toLowerCase().includes(query) ||
        row.role.toLowerCase().includes(query) ||
        row.branchNames.join(" ").toLowerCase().includes(query)
      );
    });
  }, [rows, search]);

  return (
    <div>
      <div className="border-b border-border p-4">
        <input
          className="input"
          placeholder="Search users by name, email, role, or branch..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {/* overflow-x-auto: Safari otherwise clips the actions column inside overflow-hidden cards */}
      <div className="overflow-x-auto">
        <SortableTable
          tableId="admin-users"
          data={filtered}
          keyExtractor={(row) => row.membershipId}
          defaultSort={{ columnId: "user", direction: "asc" }}
          columns={[
            {
              id: "user",
              label: "User",
              sortValue: (row) => row.userName,
              render: (row) => (
                <>
                  <p className="font-semibold text-foreground">{row.userName}</p>
                  <p className="muted">{row.userEmail}</p>
                </>
              )
            },
            {
              id: "role",
              label: "Role",
              sortValue: (row) => row.role,
              render: (row) => <span className="text-sm">{row.role}</span>
            },
            {
              id: "branches",
              label: "Branches",
              sortValue: (row) => row.branchNames.join(", "),
              render: (row) => (
                <span className="text-sm text-muted-foreground">
                  {row.branchNames.length > 0 ? row.branchNames.join(", ") : "None"}
                </span>
              )
            },
            {
              id: "status",
              label: "Status",
              sortValue: (row) => row.status,
              render: (row) => (
                <div className="grid gap-1">
                  <StatusBadge value={row.status} />
                  <span className="text-xs text-muted-foreground">
                    {row.seatAssigned ? "Seat assigned" : "No seat"}
                  </span>
                </div>
              )
            },
            {
              id: "lastLogin",
              label: "Last Login",
              sortValue: (row) => row.lastLoginAt ?? "",
              render: (row) => (
                <span className="text-sm text-muted-foreground">
                  {row.lastLoginAt ? formatDateTime(row.lastLoginAt) : "Never"}
                </span>
              )
            },
            {
              id: "actions",
              // Non-empty label keeps Safari from collapsing the column to ~0 width.
              label: "Actions",
              sortable: false,
              reorderable: false,
              className: "whitespace-nowrap",
              headerClassName: "w-[1%] whitespace-nowrap",
              render: (row) => (
                <button
                  type="button"
                  className={
                    selectedMembershipId === row.membershipId ? "btn" : "btn-secondary"
                  }
                  onClick={() => onSelect(row.membershipId)}
                >
                  {selectedMembershipId === row.membershipId ? "Editing" : "Edit"}
                </button>
              )
            }
          ]}
        />
      </div>
    </div>
  );
}
