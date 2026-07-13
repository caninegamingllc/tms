"use client";

import { SortableTable } from "@/components/sortable-table";

export type CommissionProfileRow = {
  id: string;
  name: string;
  branchSharePercent: string;
  companySharePercent: string;
  expenseFloorPercent: string;
  isDefault: boolean;
  branchNames: string;
};

export function CommissionProfilesTable({ profiles }: { profiles: CommissionProfileRow[] }) {
  return (
    <SortableTable
      data={profiles}
      keyExtractor={(profile) => profile.id}
      defaultSort={{ columnId: "name", direction: "asc" }}
      columns={[
        {
          id: "name",
          label: "Name",
          sortValue: (profile) => profile.name,
          render: (profile) => <span className="font-semibold">{profile.name}</span>
        },
        {
          id: "branchPercent",
          label: "Branch %",
          sortValue: (profile) => profile.branchSharePercent,
          render: (profile) => `${profile.branchSharePercent}%`
        },
        {
          id: "companyPercent",
          label: "Company %",
          sortValue: (profile) => profile.companySharePercent,
          render: (profile) => `${profile.companySharePercent}%`
        },
        {
          id: "expenseFloor",
          label: "Expense Floor %",
          sortValue: (profile) => profile.expenseFloorPercent,
          render: (profile) => `${profile.expenseFloorPercent}%`
        },
        {
          id: "default",
          label: "Default",
          sortValue: (profile) => profile.isDefault,
          render: (profile) => (profile.isDefault ? "Yes" : "No")
        },
        {
          id: "branches",
          label: "Branches",
          sortValue: (profile) => profile.branchNames,
          render: (profile) => profile.branchNames || "—"
        }
      ]}
    />
  );
}
