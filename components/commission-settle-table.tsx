"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { clsx } from "clsx";
import { useSortedRows, useClientPagination, type SortableColumn } from "@/components/sortable-table";
import { TablePagination } from "@/components/table-pagination";
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
  const pagination = useClientPagination(sortedData, rows);
  const pageRows = pagination.pageRows;

  const pagePayableIds = pageRows.filter((row) => row.canSettle).map((row) => row.id);
  const allPageSelected =
    pagePayableIds.length > 0 && pagePayableIds.every((id) => selected.includes(id));

  function toggleAllPage() {
    setSelected((current) => {
      if (allPageSelected) {
        return current.filter((id) => !pagePayableIds.includes(id));
      }
      const next = new Set(current);
      for (const id of pagePayableIds) {
        next.add(id);
      }
      return [...next];
    });
  }

  function toggleOne(id: string) {
    const row = rows.find((entry) => entry.id === id);
    if (!row?.canSettle) {
      return;
    }

    setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  }

  const dataColumns = canSettle ? columns.slice(1) : columns;

  return (
    <section className="card overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border p-5">
        <div>
          <h2 className="section-title">Commission & Settlement</h2>
          <p className="muted">
            Branch commission becomes payable once the customer has paid the load. Select payable rows to batch-settle branch commissions. Click column headers to sort.
          </p>
        </div>
        {canSettle ? (
          <form action={settleBranchCommission}>
            {selected.map((id) => (
              <input key={id} type="hidden" name="commissionIds" value={id} />
            ))}
            <button type="submit" className="btn" disabled={selected.length === 0}>
              {selected.length > 0
                ? `Mark ${selected.length} selected as settled`
                : "Mark selected as settled"}
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
                    className="h-4 w-4 rounded border-border"
                    checked={allPageSelected}
                    disabled={pagePayableIds.length === 0}
                    onChange={toggleAllPage}
                    aria-label="Select all payable commissions on this page"
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
              pageRows.map((row) => (
                <tr key={row.id}>
                  {canSettle ? (
                    <td>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border disabled:cursor-not-allowed disabled:opacity-40"
                        checked={row.canSettle && selected.includes(row.id)}
                        disabled={!row.canSettle}
                        onChange={() => toggleOne(row.id)}
                        title={
                          row.canSettle
                            ? `Select load ${row.loadNumber}`
                            : "Payable after the customer pays this load"
                        }
                        aria-label={
                          row.canSettle
                            ? `Select load ${row.loadNumber}`
                            : `Load ${row.loadNumber} is not yet payable`
                        }
                      />
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
      <div className="px-5 pb-5">
        <TablePagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={pagination.total}
          totalPages={pagination.totalPages}
          start={pagination.start}
          end={pagination.end}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
        />
      </div>
    </section>
  );
}
