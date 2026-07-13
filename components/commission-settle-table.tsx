"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { clsx } from "clsx";
import { useSortedRows, type SortableColumn } from "@/components/sortable-table";
import { settleBranchCommission } from "@/lib/commission-actions";

type CommissionRow = {
  id: string;
  loadId: string;
  loadNumber: string;
  branchName: string;
  customerName: string;
  lane: string;
  pickupDate: string;
  pickupDateRaw: string;
  revenue: string;
  revenueCents: number;
  grossExpenses: string;
  grossProfit: string;
  grossProfitCents: number;
  commissionable: boolean;
  profileName: string;
  branchCommission: string;
  branchCommissionCents: number;
  companyShare: string;
  calculationMethod: string;
  status: string;
  customerPaidAt: string;
  canSettle: boolean;
};

function buildColumns(canSettle: boolean): SortableColumn<CommissionRow>[] {
  const columns: SortableColumn<CommissionRow>[] = [];

  if (canSettle) {
    columns.push({
      id: "select",
      label: "",
      sortable: false,
      render: () => null
    });
  }

  columns.push(
    {
      id: "load",
      label: "Load",
      sortValue: (row) => row.loadNumber,
      render: (row) => (
        <a href={`/loads/${row.loadId}`} className="font-semibold text-primary">
          {row.loadNumber}
        </a>
      )
    },
    {
      id: "branch",
      label: "Branch",
      sortValue: (row) => row.branchName,
      render: (row) => row.branchName
    },
    {
      id: "customer",
      label: "Customer",
      sortValue: (row) => row.customerName,
      render: (row) => row.customerName
    },
    {
      id: "lane",
      label: "Lane",
      sortValue: (row) => row.lane,
      render: (row) => row.lane
    },
    {
      id: "pickup",
      label: "Pickup",
      sortValue: (row) => row.pickupDateRaw,
      render: (row) => row.pickupDate
    },
    {
      id: "revenue",
      label: "Revenue",
      sortValue: (row) => row.revenueCents,
      render: (row) => row.revenue
    },
    {
      id: "grossExpenses",
      label: "Gross Expenses",
      sortValue: (row) => row.grossExpenses,
      render: (row) => row.grossExpenses
    },
    {
      id: "grossProfit",
      label: "Gross Profit",
      sortValue: (row) => row.grossProfitCents,
      render: (row) => row.grossProfit
    },
    {
      id: "commissionable",
      label: "Commissionable",
      sortValue: (row) => row.commissionable,
      render: (row) => (row.commissionable ? "Yes" : "No")
    },
    {
      id: "profile",
      label: "Profile",
      sortValue: (row) => row.profileName,
      render: (row) => row.profileName
    },
    {
      id: "branchCommission",
      label: "Branch Commission",
      sortValue: (row) => row.branchCommissionCents,
      render: (row) => <span className="font-semibold">{row.branchCommission}</span>
    },
    {
      id: "companyShare",
      label: "Company Share",
      sortValue: (row) => row.companyShare,
      render: (row) => row.companyShare
    },
    {
      id: "calculationMethod",
      label: "Calc Method",
      sortValue: (row) => row.calculationMethod,
      render: (row) => row.calculationMethod
    },
    {
      id: "status",
      label: "Settlement",
      sortValue: (row) => row.status,
      render: (row) => row.status
    },
    {
      id: "customerPaidAt",
      label: "Customer Paid",
      sortValue: (row) => row.customerPaidAt,
      render: (row) => row.customerPaidAt
    }
  );

  return columns;
}

export function CommissionSettleTable({
  rows,
  canSettle
}: {
  rows: CommissionRow[];
  canSettle: boolean;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const columns = useMemo(() => buildColumns(canSettle), [canSettle]);
  const { sortedData, sortState, handleSort } = useSortedRows(rows, columns, {
    columnId: "pickup",
    direction: "desc"
  });

  const payableIds = rows.filter((row) => row.canSettle).map((row) => row.id);
  const allSelected = payableIds.length > 0 && payableIds.every((id) => selected.includes(id));

  function toggleAll() {
    setSelected(allSelected ? [] : payableIds);
  }

  function toggleOne(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  }

  const dataColumns = canSettle ? columns.slice(1) : columns;

  return (
    <section className="card overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border p-5">
        <div>
          <h2 className="section-title">Commission & Settlement</h2>
          <p className="muted">Branch commission becomes payable once the customer has paid the load. Click column headers to sort.</p>
        </div>
        {canSettle ? (
          <form action={settleBranchCommission}>
            {selected.map((id) => (
              <input key={id} type="hidden" name="commissionIds" value={id} />
            ))}
            <button type="submit" className="btn" disabled={selected.length === 0}>
              Mark {selected.length || ""} selected as settled
            </button>
          </form>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              {canSettle ? (
                <th>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all payable commissions"
                  />
                </th>
              ) : null}
              {dataColumns.map((column) => {
                const isSortable = column.sortable !== false && column.sortValue != null;
                const isActive = sortState.columnId === column.id;

                return (
                  <th
                    key={column.id}
                    className={clsx(isSortable && "sortable")}
                    data-active={isActive || undefined}
                  >
                    {isSortable ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-left"
                        onClick={() => handleSort(column.id)}
                      >
                        <span>{column.label}</span>
                        {isActive ? (
                          sortState.direction === "asc" ? (
                            <ArrowUp className="sort-icon" aria-hidden="true" />
                          ) : (
                            <ArrowDown className="sort-icon" aria-hidden="true" />
                          )
                        ) : (
                          <ChevronsUpDown className="sort-icon" aria-hidden="true" />
                        )}
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="muted">
                  No commission records match the current filters.
                </td>
              </tr>
            ) : (
              sortedData.map((row) => (
                <tr key={row.id}>
                  {canSettle ? (
                    <td>
                      {row.canSettle ? (
                        <input
                          type="checkbox"
                          checked={selected.includes(row.id)}
                          onChange={() => toggleOne(row.id)}
                          aria-label={`Select ${row.loadNumber}`}
                        />
                      ) : null}
                    </td>
                  ) : null}
                  {dataColumns.map((column) => (
                    <td key={column.id}>{column.render(row)}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
