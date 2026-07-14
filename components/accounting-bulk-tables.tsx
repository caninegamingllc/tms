"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  SortableTableHeader,
  useClientPagination,
  useSortedRows,
  type SortableColumn
} from "@/components/sortable-table";
import { TablePagination } from "@/components/table-pagination";
import { StatusBadge } from "@/components/status-badge";
import { formatDate, formatMoney } from "@/lib/format";
import {
  bulkEmailInvoicesAction,
  bulkPushBillsToQuickbooks,
  bulkPushInvoicesToQuickbooks,
  receiveArPayment,
  recordApPayment
} from "@/lib/accounting-actions";
import { markInvoicePaid } from "@/lib/commission-actions";
import { markCarrierBillPaid } from "@/lib/quickbooks/actions";
import type { QuickbooksMethod } from "@/lib/quickbooks/types";

export type AccountingInvoiceRow = {
  id: string;
  invoiceNo: string;
  loadId: string;
  loadNumber: string;
  referenceNumber: string | null;
  customerId: string;
  customerName: string;
  status: string;
  totalCents: number;
  balanceCents: number;
  issuedAt: string | null;
  dueAt: string | null;
  deliveryAt: string | null;
  sentLabel: string;
  exportLabel: string | null;
  canMarkPaid: boolean;
  canPushOnline: boolean;
};

/** Load-centric AP row: may or may not have a recorded bill yet. */
export type AccountingApLoadRow = {
  rowKey: string;
  loadId: string;
  loadNumber: string;
  loadStatus: string;
  referenceNumber: string | null;
  carrierId: string;
  carrierName: string;
  deliveryAt: string | null;
  loadExpenseCents: number;
  billId: string | null;
  billNo: string | null;
  billReference: string | null;
  billStatus: string | null;
  receivedAt: string | null;
  dueAt: string | null;
  amountBilledCents: number;
  balanceCents: number;
  remitTo: string;
  exportLabel: string | null;
  canMarkPaid: boolean;
  canPushOnline: boolean;
};

function useSelection() {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  /** Select or deselect only the given ids (e.g. current page), keeping other pages' selections. */
  function toggleAll(ids: string[], checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) {
        for (const id of ids) {
          next.add(id);
        }
      } else {
        for (const id of ids) {
          next.delete(id);
        }
      }
      return next;
    });
  }

  function clear() {
    setSelected(new Set());
  }

  return { selected, toggle, toggleAll, clear, count: selected.size };
}

export function AccountingInvoicesPanel({
  invoices,
  quickbooksMethod
}: {
  invoices: AccountingInvoiceRow[];
  quickbooksMethod: QuickbooksMethod;
}) {
  const [query, setQuery] = useState("");
  const [showPayment, setShowPayment] = useState(false);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return invoices;
    }
    return invoices.filter((row) =>
      [row.customerName, row.invoiceNo, row.loadNumber, row.referenceNumber, row.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [invoices, query]);

  const columns: SortableColumn<AccountingInvoiceRow>[] = useMemo(
    () => [
      {
        id: "select",
        label: "",
        sortable: false,
        render: () => null
      },
      {
        id: "customer",
        label: "Company Name",
        sortValue: (row) => row.customerName,
        render: (row) => row.customerName
      },
      {
        id: "invoice",
        label: "Invoice #",
        sortValue: (row) => row.invoiceNo,
        render: (row) => row.invoiceNo
      },
      {
        id: "load",
        label: "Load / Ref",
        sortValue: (row) => row.loadNumber,
        render: (row) => row.loadNumber
      },
      {
        id: "delivery",
        label: "Delivery",
        sortValue: (row) => row.deliveryAt ?? "",
        render: (row) => (row.deliveryAt ? formatDate(row.deliveryAt) : "—")
      },
      {
        id: "sent",
        label: "Sent",
        sortValue: (row) => row.sentLabel,
        render: (row) => row.sentLabel
      },
      {
        id: "issued",
        label: "Invoice Date",
        sortValue: (row) => row.issuedAt ?? "",
        render: (row) => (row.issuedAt ? formatDate(row.issuedAt) : "—")
      },
      {
        id: "due",
        label: "Due Date",
        sortValue: (row) => row.dueAt ?? "",
        render: (row) => (row.dueAt ? formatDate(row.dueAt) : "—")
      },
      {
        id: "total",
        label: "Total",
        sortValue: (row) => row.totalCents,
        render: (row) => formatMoney(row.totalCents)
      },
      {
        id: "balance",
        label: "Balance",
        sortValue: (row) => row.balanceCents,
        render: (row) => formatMoney(row.balanceCents)
      },
      ...(quickbooksMethod !== "NONE"
        ? [
            {
              id: "qb",
              label: "QB",
              sortValue: (row: AccountingInvoiceRow) => row.exportLabel ?? "",
              render: (row: AccountingInvoiceRow) => row.exportLabel ?? "—"
            }
          ]
        : []),
      {
        id: "actions",
        label: "Actions",
        sortable: false,
        render: () => null
      }
    ],
    [quickbooksMethod]
  );

  const { sortedData, sortState, handleSort } = useSortedRows(filtered, columns, {
    columnId: "due",
    direction: "desc"
  });
  const pagination = useClientPagination(sortedData, query);
  const pageRows = pagination.pageRows;
  const pageIds = pageRows.map((row) => row.id);
  const selection = useSelection();
  const selectedRows = sortedData.filter((row) => selection.selected.has(row.id));
  const openBalance = selectedRows.reduce((sum, row) => sum + row.balanceCents, 0);
  const sameCustomer =
    selectedRows.length > 0 &&
    selectedRows.every((row) => row.customerId === selectedRows[0].customerId);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selection.selected.has(id));

  const headerColumns = columns.map((column) =>
    column.id === "select"
      ? {
          ...column,
          label: (
            <input
              type="checkbox"
              aria-label="Select all invoices on this page"
              checked={allPageSelected}
              disabled={pageIds.length === 0}
              onChange={(event) => selection.toggleAll(pageIds, event.target.checked)}
            />
          )
        }
      : column
  );

  return (
    <div>
      {selection.count > 0 ? (
        <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-emerald-900">
              Selected {selection.count} Invoice{selection.count === 1 ? "" : "s"}
            </p>
            <button type="button" className="btn-secondary" onClick={selection.clear}>
              Clear Selected Invoices
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <form action={bulkEmailInvoicesAction}>
              {[...selection.selected].map((id) => (
                <input key={id} type="hidden" name="invoiceIds" value={id} />
              ))}
              <button type="submit" className="btn">
                Email Invoices
              </button>
            </form>
            <button type="button" className="btn" onClick={() => setShowPayment(true)}>
              Receive a Payment
            </button>
            {quickbooksMethod === "ONLINE" ? (
              <form action={bulkPushInvoicesToQuickbooks}>
                {[...selection.selected].map((id) => (
                  <input key={id} type="hidden" name="invoiceIds" value={id} />
                ))}
                <button type="submit" className="btn">
                  Export Invoices to QB
                </button>
              </form>
            ) : null}
            {selectedRows.length === 1 && selectedRows[0].canMarkPaid ? (
              <form action={markInvoicePaid}>
                <input type="hidden" name="invoiceId" value={selectedRows[0].id} />
                <button type="submit" className="btn-secondary">
                  Mark Paid
                </button>
              </form>
            ) : null}
          </div>
          {showPayment ? (
            <form action={receiveArPayment} className="mt-4 grid gap-3 rounded-2xl bg-white p-4">
              {[...selection.selected].map((id) => (
                <input key={id} type="hidden" name="invoiceIds" value={id} />
              ))}
              {!sameCustomer ? (
                <p className="text-sm font-semibold text-rose-700">
                  Select invoices for one customer at a time to receive a payment.
                </p>
              ) : (
                <>
                  <p className="text-sm text-slate-700">
                    Applying to {selectedRows[0].customerName}. Open balance{" "}
                    {formatMoney(openBalance)}.
                  </p>
                  <div className="grid gap-3 md:grid-cols-4">
                    <input
                      name="amount"
                      className="input"
                      placeholder={`Amount (default ${formatMoney(openBalance)})`}
                    />
                    <input name="paidAt" className="input" type="date" />
                    <select name="method" className="select" defaultValue="CHECK">
                      <option value="CHECK">Check</option>
                      <option value="ACH">ACH</option>
                      <option value="WIRE">Wire</option>
                      <option value="CARD">Card</option>
                      <option value="OTHER">Other</option>
                    </select>
                    <input name="reference" className="input" placeholder="Reference / check #" />
                  </div>
                  <input name="notes" className="input" placeholder="Notes" />
                  <div className="flex flex-wrap gap-2">
                    <button type="submit" className="btn">
                      Apply Payment
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => setShowPayment(false)}>
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </form>
          ) : null}
        </div>
      ) : null}

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          className="input max-w-xl flex-1"
          placeholder="Search company name, invoice #, load #, or status"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="table min-w-full text-left text-sm">
          <SortableTableHeader columns={headerColumns} sortState={sortState} onSort={handleSort} />
          <tbody>
            {pageRows.map((row) => (
              <tr
                key={row.id}
                className={selection.selected.has(row.id) ? "bg-amber-50" : undefined}
              >
                <td>
                  <input
                    type="checkbox"
                    checked={selection.selected.has(row.id)}
                    onChange={() => selection.toggle(row.id)}
                  />
                </td>
                <td className="font-medium">{row.customerName}</td>
                <td>
                  <span className="font-semibold">{row.invoiceNo}</span>{" "}
                  <StatusBadge value={row.status} />
                </td>
                <td>
                  <Link href={`/loads/${row.loadId}`} className="text-primary">
                    {row.loadNumber}
                  </Link>
                  {row.referenceNumber ? (
                    <span className="block text-xs text-muted-foreground">{row.referenceNumber}</span>
                  ) : null}
                </td>
                <td>{row.deliveryAt ? formatDate(row.deliveryAt) : "—"}</td>
                <td>{row.sentLabel}</td>
                <td>{row.issuedAt ? formatDate(row.issuedAt) : "—"}</td>
                <td>{row.dueAt ? formatDate(row.dueAt) : "—"}</td>
                <td>{formatMoney(row.totalCents)}</td>
                <td className="font-semibold">{formatMoney(row.balanceCents)}</td>
                {quickbooksMethod !== "NONE" ? <td>{row.exportLabel ?? "—"}</td> : null}
                <td>
                  {row.canMarkPaid ? (
                    <form action={markInvoicePaid}>
                      <input type="hidden" name="invoiceId" value={row.id} />
                      <button type="submit" className="text-xs font-semibold text-primary">
                        Mark paid
                      </button>
                    </form>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
            {sortedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-8 text-center text-muted-foreground">
                  No invoices match this search.
                </td>
              </tr>
            ) : null}
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

export function AccountingBillsPanel({
  rows,
  quickbooksMethod
}: {
  rows: AccountingApLoadRow[];
  quickbooksMethod: QuickbooksMethod;
}) {
  const [query, setQuery] = useState("");
  const [showPayment, setShowPayment] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return rows;
    }
    return rows.filter((row) =>
      [
        row.carrierName,
        row.remitTo,
        row.loadNumber,
        row.billNo,
        row.billReference,
        row.referenceNumber,
        row.loadStatus
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [rows, query]);

  const columns: SortableColumn<AccountingApLoadRow>[] = useMemo(
    () => [
      { id: "expand", label: "", sortable: false, render: () => null },
      { id: "select", label: "", sortable: false, render: () => null },
      {
        id: "company",
        label: "Company Name",
        sortValue: (row) => row.carrierName,
        render: (row) => row.carrierName
      },
      {
        id: "load",
        label: "Load #",
        sortValue: (row) => row.loadNumber,
        render: (row) => row.loadNumber
      },
      {
        id: "ref",
        label: "Reference #",
        sortValue: (row) => row.referenceNumber ?? "",
        render: (row) => row.referenceNumber ?? "—"
      },
      {
        id: "delivery",
        label: "Delivery Date",
        sortValue: (row) => row.deliveryAt ?? "",
        render: (row) => (row.deliveryAt ? formatDate(row.deliveryAt) : "—")
      },
      {
        id: "billDate",
        label: "Bill Date",
        sortValue: (row) => row.receivedAt ?? "",
        render: (row) => (row.receivedAt ? formatDate(row.receivedAt) : "—")
      },
      {
        id: "due",
        label: "Due Date",
        sortValue: (row) => row.dueAt ?? "",
        render: (row) => (row.dueAt ? formatDate(row.dueAt) : "—")
      },
      {
        id: "billRef",
        label: "Bill Ref #",
        sortValue: (row) => row.billReference ?? "",
        render: (row) => row.billReference ?? "—"
      },
      {
        id: "expenses",
        label: "Load Expenses",
        sortValue: (row) => row.loadExpenseCents,
        render: (row) => formatMoney(row.loadExpenseCents)
      },
      {
        id: "billed",
        label: "Amount Billed",
        sortValue: (row) => row.amountBilledCents,
        render: (row) => formatMoney(row.amountBilledCents)
      },
      {
        id: "balance",
        label: "Balance to Pay",
        sortValue: (row) => row.balanceCents,
        render: (row) => formatMoney(row.balanceCents)
      },
      {
        id: "remit",
        label: "Remit To",
        sortValue: (row) => row.remitTo,
        render: (row) => row.remitTo
      }
    ],
    []
  );

  const { sortedData, sortState, handleSort } = useSortedRows(filtered, columns, {
    columnId: "delivery",
    direction: "desc"
  });

  const pagination = useClientPagination(sortedData, query);
  const pageRows = pagination.pageRows;
  const pageBillIds = pageRows.filter((row) => row.billId).map((row) => row.billId!);
  const selection = useSelection();
  const selectedRows = sortedData.filter(
    (row) => row.billId && selection.selected.has(row.billId)
  );
  const openBalance = selectedRows.reduce((sum, row) => sum + row.balanceCents, 0);
  const sameCarrier =
    selectedRows.length > 0 &&
    selectedRows.every((row) => row.carrierId === selectedRows[0].carrierId);
  const allPageSelected =
    pageBillIds.length > 0 && pageBillIds.every((id) => selection.selected.has(id));

  const headerColumns = columns.map((column) =>
    column.id === "select"
      ? {
          ...column,
          label: (
            <input
              type="checkbox"
              aria-label="Select all bills on this page"
              checked={allPageSelected}
              disabled={pageBillIds.length === 0}
              onChange={(event) => selection.toggleAll(pageBillIds, event.target.checked)}
            />
          )
        }
      : column
  );

  function toggleExpanded(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  return (
    <div>
      {selection.count > 0 ? (
        <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-emerald-900">
              Selected {selection.count} Bill{selection.count === 1 ? "" : "s"}
            </p>
            <button type="button" className="btn-secondary" onClick={selection.clear}>
              Clear Selected Bills
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedRows.length === 1 && selectedRows[0].billId ? (
              <Link href={`/accounting/bills/${selectedRows[0].billId}`} className="btn">
                Edit Bill
              </Link>
            ) : null}
            {quickbooksMethod === "ONLINE" ? (
              <form action={bulkPushBillsToQuickbooks}>
                {[...selection.selected].map((id) => (
                  <input key={id} type="hidden" name="billIds" value={id} />
                ))}
                <button type="submit" className="btn">
                  Export Bill to QB
                </button>
              </form>
            ) : null}
            <button type="button" className="btn" onClick={() => setShowPayment(true)}>
              Record a Bill Payment
            </button>
            {selectedRows.length === 1 && selectedRows[0].canMarkPaid && selectedRows[0].billId ? (
              <form action={markCarrierBillPaid}>
                <input type="hidden" name="billId" value={selectedRows[0].billId} />
                <button type="submit" className="btn-secondary">
                  Mark Paid
                </button>
              </form>
            ) : null}
          </div>
          {showPayment ? (
            <form action={recordApPayment} className="mt-4 grid gap-3 rounded-2xl bg-white p-4">
              {[...selection.selected].map((id) => (
                <input key={id} type="hidden" name="billIds" value={id} />
              ))}
              {!sameCarrier ? (
                <p className="text-sm font-semibold text-rose-700">
                  Select bills for one carrier at a time to record a payment.
                </p>
              ) : (
                <>
                  <p className="text-sm text-slate-700">
                    Paying {selectedRows[0].remitTo}. Open balance {formatMoney(openBalance)}.
                  </p>
                  <div className="grid gap-3 md:grid-cols-4">
                    <input
                      name="amount"
                      className="input"
                      placeholder={`Amount (default ${formatMoney(openBalance)})`}
                    />
                    <input name="paidAt" className="input" type="date" />
                    <select name="method" className="select" defaultValue="CHECK">
                      <option value="CHECK">Check</option>
                      <option value="ACH">ACH</option>
                      <option value="WIRE">Wire</option>
                      <option value="OTHER">Other</option>
                    </select>
                    <input name="reference" className="input" placeholder="Reference / check #" />
                  </div>
                  <input name="notes" className="input" placeholder="Notes" />
                  <div className="flex flex-wrap gap-2">
                    <button type="submit" className="btn">
                      Apply Payment
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => setShowPayment(false)}>
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </form>
          ) : null}
        </div>
      ) : null}

      <div className="mb-3">
        <input
          className="input max-w-xl"
          placeholder="Search company name, remit to, load #, bill #, or reference"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="table min-w-full text-left text-sm">
          <SortableTableHeader columns={headerColumns} sortState={sortState} onSort={handleSort} />
          <tbody>
            {pageRows.map((row) => {
              const isOpen = expanded.has(row.rowKey);
              return (
                <Fragment key={row.rowKey}>
                  <tr
                    className={
                      row.billId && selection.selected.has(row.billId) ? "bg-amber-50" : undefined
                    }
                  >
                    <td>
                      <button
                        type="button"
                        className="rounded p-1 text-muted-foreground hover:bg-muted"
                        onClick={() => toggleExpanded(row.rowKey)}
                        aria-label={isOpen ? "Collapse row" : "Expand row"}
                      >
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                    <td>
                      {row.billId ? (
                        <input
                          type="checkbox"
                          checked={selection.selected.has(row.billId)}
                          onChange={() => selection.toggle(row.billId!)}
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="font-medium">{row.carrierName}</td>
                    <td>
                      <Link href={`/loads/${row.loadId}`} className="text-primary">
                        {row.loadNumber}
                      </Link>{" "}
                      <StatusBadge value={row.loadStatus} />
                    </td>
                    <td>{row.referenceNumber ?? "—"}</td>
                    <td>{row.deliveryAt ? formatDate(row.deliveryAt) : "—"}</td>
                    <td>{row.receivedAt ? formatDate(row.receivedAt) : "—"}</td>
                    <td>{row.dueAt ? formatDate(row.dueAt) : "—"}</td>
                    <td>
                      {row.billReference ?? "—"}
                      {row.billStatus ? (
                        <span className="ml-1">
                          <StatusBadge value={row.billStatus} />
                        </span>
                      ) : null}
                    </td>
                    <td>{formatMoney(row.loadExpenseCents)}</td>
                    <td>{row.billId ? formatMoney(row.amountBilledCents) : "—"}</td>
                    <td className="font-semibold">
                      {row.billId ? formatMoney(row.balanceCents) : "—"}
                    </td>
                    <td>{row.remitTo}</td>
                  </tr>
                  {isOpen ? (
                    <tr className="bg-slate-50">
                      <td colSpan={columns.length} className="p-4">
                        {row.billId ? (
                          <div className="flex flex-wrap items-center gap-3">
                            <p className="text-sm text-slate-700">
                              Bill {row.billNo}
                              {row.billReference ? ` · Ref ${row.billReference}` : ""} · Remit to{" "}
                              {row.remitTo}
                            </p>
                            <Link href={`/accounting/bills/${row.billId}`} className="btn">
                              Edit Bill
                            </Link>
                          </div>
                        ) : (
                          <Link
                            href={`/accounting/bills/new?loadId=${row.loadId}`}
                            className="btn"
                          >
                            + Record a Received Bill From {row.carrierName} on Load #
                            {row.loadNumber}
                          </Link>
                        )}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
            {sortedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-8 text-center text-muted-foreground">
                  No covered loads or bills match this search.
                </td>
              </tr>
            ) : null}
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
