"use client";

import { SortableTable } from "@/components/sortable-table";
import { deleteBranch } from "@/lib/admin-actions";

export type AdminBranchRow = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  userCount: number;
  customerCount: number;
  carrierCount: number;
  loadCount: number;
  canDelete: boolean;
};

export function AdminBranchesTable({ rows }: { rows: AdminBranchRow[] }) {
  return (
    <SortableTable
      tableId="admin-branches"
      data={rows}
      keyExtractor={(row) => row.id}
      defaultSort={{ columnId: "name", direction: "asc" }}
      columns={[
        {
          id: "name",
          label: "Branch",
          sortValue: (row) => row.name,
          render: (row) => (
            <>
              <p className="font-semibold text-foreground">{row.name}</p>
              <p className="muted">
                {[row.city, row.state].filter(Boolean).join(", ") || "No location"}
              </p>
            </>
          )
        },
        {
          id: "users",
          label: "Users",
          sortValue: (row) => row.userCount,
          render: (row) => row.userCount
        },
        {
          id: "customers",
          label: "Customers",
          sortValue: (row) => row.customerCount,
          render: (row) => row.customerCount
        },
        {
          id: "carriers",
          label: "Carriers",
          sortValue: (row) => row.carrierCount,
          render: (row) => row.carrierCount
        },
        {
          id: "loads",
          label: "Loads",
          sortValue: (row) => row.loadCount,
          render: (row) => row.loadCount
        },
        {
          id: "actions",
          label: "Actions",
          sortable: false,
          render: (row) =>
            row.canDelete ? (
              <form action={deleteBranch}>
                <input type="hidden" name="branchId" value={row.id} />
                <button className="btn-danger" type="submit">
                  Delete
                </button>
              </form>
            ) : (
              <span className="text-xs text-muted-foreground">In use</span>
            )
        }
      ]}
    />
  );
}
