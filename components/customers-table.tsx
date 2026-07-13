"use client";

import { SortableTable } from "@/components/sortable-table";
import { formatMoney } from "@/lib/format";

export type CustomerTableRow = {
  id: string;
  name: string;
  city: string;
  state: string;
  branchName: string;
  contactName: string;
  contactEmail: string;
  paymentTerms: string;
  creditLimit: number;
  loadCount: number;
  openArCents: number;
};

export function CustomersTable({ customers }: { customers: CustomerTableRow[] }) {
  return (
    <SortableTable
      data={customers}
      keyExtractor={(customer) => customer.id}
      defaultSort={{ columnId: "name", direction: "asc" }}
      columns={[
        {
          id: "name",
          label: "Name",
          sortValue: (customer) => customer.name,
          render: (customer) => (
            <>
              <p className="font-semibold text-foreground">{customer.name}</p>
              <p className="muted">
                {customer.city}, {customer.state}
              </p>
            </>
          )
        },
        {
          id: "branch",
          label: "Branch",
          sortValue: (customer) => customer.branchName,
          render: (customer) => customer.branchName
        },
        {
          id: "contact",
          label: "Primary Contact",
          sortValue: (customer) => customer.contactName,
          render: (customer) => (
            <>
              <p>{customer.contactName}</p>
              <p className="muted">{customer.contactEmail}</p>
            </>
          )
        },
        {
          id: "terms",
          label: "Terms",
          sortValue: (customer) => customer.paymentTerms,
          render: (customer) => customer.paymentTerms
        },
        {
          id: "credit",
          label: "Credit",
          sortValue: (customer) => customer.creditLimit,
          render: (customer) => formatMoney(customer.creditLimit)
        },
        {
          id: "loads",
          label: "Loads",
          sortValue: (customer) => customer.loadCount,
          render: (customer) => customer.loadCount
        },
        {
          id: "openAr",
          label: "Open AR",
          sortValue: (customer) => customer.openArCents,
          render: (customer) => formatMoney(customer.openArCents)
        }
      ]}
    />
  );
}
