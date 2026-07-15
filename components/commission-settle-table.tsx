"use client";

import { useMemo, useState } from "react";
import {
  useSortedRows,
  useClientPagination,
  useOrderedColumns,
  SortableTableHeader,
  ColumnLayoutControls,
  type SortableColumn
} from "@/components/sortable-table";
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
      reorderable: false,
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
  const { orderedColumns, moveColumn, resetOrder, isCustomized } = useOrderedColumns(
    "commission-settle",
    columns
  );
  const { sortedData, sortState, handleSort } = useSortedRows(rows, orderedColumns, {
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

    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );
  }

  const headerColumns = orderedColumns.map((column) =>
    column.id === "select"
      ? {
          ...column,
          label: (
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border"
              checked={allPageSelected}
              disabled={pagePayableIds.length === 0}
              onChange={toggleAllPage}
              aria-label="Select all payable commissions on this page"
            />
          )
        }
      : column
  );

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="muted">
          Branch commission becomes payable once the customer has paid the load. Select payable rows to
          batch-settle branch commissions. Drag column handles to reorder.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <ColumnLayoutControls
            className="mb-0"
            onReset={resetOrder}
            isCustomized={isCustomized}
          />
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
      </div>

      <div className="overflow-x-auto">
        <table className="table">
          <SortableTableHeader
            columns={headerColumns}
            sortState={sortState}
            onSort={handleSort}
            columnReorder
            onMoveColumn={moveColumn}
          />
          <tbody>
            {sortedData.length === 0 ? (
              <tr>
                <td colSpan={orderedColumns.length} className="muted">
                  No commission records match the current filters.
                </td>
              </tr>
            ) : (
              pageRows.map((row) => (
                <tr key={row.id}>
                  {orderedColumns.map((column) =>
                    column.id === "select" ? (
                      <td key={column.id}>
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
                    ) : (
                      <td key={column.id}>{column.render(row)}</td>
                    )
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
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
  );
}
