"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useClientPagination } from "@/components/sortable-table";
import { TablePagination } from "@/components/table-pagination";
import {
  AGING_BUCKET_LABELS,
  bucketBalance,
  daysPastDue,
  sumAgingBuckets,
  type AgingBucketKey
} from "@/lib/accounting-aging";
import { formatDate, formatMoney } from "@/lib/format";

export type AgingArRow = {
  id: string;
  entityName: string;
  invoiceNo: string;
  loadId: string;
  loadNumber: string;
  referenceNumber: string | null;
  paymentTerms: string;
  issuedAt: string | null;
  dueAt: string | null;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
};

export type AgingApRow = {
  id: string;
  entityName: string;
  billNo: string;
  loadId: string;
  loadNumber: string;
  referenceNumber: string | null;
  paymentTerms: string;
  issuedAt: string | null;
  dueAt: string | null;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
};

const BUCKET_KEYS: AgingBucketKey[] = ["current", "past0to29", "past30", "past45", "past60"];

const BUCKET_CLASS: Record<AgingBucketKey, string> = {
  current: "bg-emerald-50 text-emerald-900",
  past0to29: "bg-amber-50 text-amber-900",
  past30: "bg-orange-50 text-orange-900",
  past45: "bg-orange-100 text-orange-950",
  past60: "bg-rose-50 text-rose-900"
};

function moneyOrBlank(cents: number) {
  return cents > 0 ? formatMoney(cents) : "";
}

function toCsv(rows: Array<Record<string, string | number>>) {
  if (rows.length === 0) {
    return "";
  }
  const headers = Object.keys(rows[0]);
  const escape = (value: string | number) => {
    const text = String(value);
    if (text.includes(",") || text.includes('"') || text.includes("\n")) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };
  return [headers.join(","), ...rows.map((row) => headers.map((h) => escape(row[h])).join(","))].join(
    "\n"
  );
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function AgingTable<T extends AgingArRow | AgingApRow>({
  title,
  rows,
  docLabel,
  manageHref,
  exportName
}: {
  title: string;
  rows: T[];
  docLabel: string;
  manageHref: string;
  exportName: string;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return rows;
    }
    return rows.filter((row) => {
      const docNo = "invoiceNo" in row ? row.invoiceNo : row.billNo;
      return [row.entityName, docNo, row.loadNumber, row.referenceNumber, String(row.balanceCents / 100)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [rows, query]);

  const enriched = useMemo(
    () =>
      filtered.map((row) => {
        const buckets = bucketBalance(row.balanceCents, row.dueAt);
        return { row, buckets, days: daysPastDue(row.dueAt) };
      }),
    [filtered]
  );

  const pagination = useClientPagination(enriched, query);
  const pageRows = pagination.pageRows;

  const totals = {
    totalCents: enriched.reduce((sum, item) => sum + item.row.totalCents, 0),
    paidCents: enriched.reduce((sum, item) => sum + item.row.paidCents, 0),
    balanceCents: enriched.reduce((sum, item) => sum + item.row.balanceCents, 0),
    buckets: sumAgingBuckets(enriched.map((item) => item.buckets))
  };

  function exportRows() {
    const csvRows = enriched.map(({ row, buckets, days }) => {
      const docNo = "invoiceNo" in row ? row.invoiceNo : row.billNo;
      return {
        Name: row.entityName,
        [docLabel]: docNo,
        "Load #": row.loadNumber,
        Reference: row.referenceNumber ?? "",
        "Payment Terms": row.paymentTerms,
        "Invoice/Bill Date": row.issuedAt ? formatDate(row.issuedAt) : "",
        "Due Date": row.dueAt ? formatDate(row.dueAt) : "",
        "Days Past Due": days,
        Totals: (row.totalCents / 100).toFixed(2),
        Paid: (row.paidCents / 100).toFixed(2),
        Current: (buckets.current / 100).toFixed(2),
        "0-29": (buckets.past0to29 / 100).toFixed(2),
        "30+": (buckets.past30 / 100).toFixed(2),
        "45+": (buckets.past45 / 100).toFixed(2),
        "60+": (buckets.past60 / 100).toFixed(2),
        Total: (row.balanceCents / 100).toFixed(2)
      };
    });
    downloadCsv(exportName, toCsv(csvRows));
  }

  return (
    <div className="grid gap-4 overflow-hidden rounded-lg border border-border">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
        <div>
          <p className="text-[15px] font-semibold text-foreground">{title}</p>
          <p className="muted">Aging by days past due. Amounts appear in one bucket per open balance.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={manageHref} className="btn-secondary">
            Manage {title.includes("Receivable") ? "Invoices" : "Bills"}
          </Link>
          <button type="button" className="btn-secondary" onClick={exportRows}>
            Export to CSV
          </button>
        </div>
      </div>

      <div className="border-b border-border px-4 pb-3">
        <input
          className="input max-w-xl"
          placeholder="Search company name, document #, or dollar amount"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-3">Name</th>
              <th className="px-3 py-3">{docLabel}</th>
              <th className="px-3 py-3">Load #</th>
              <th className="px-3 py-3">Terms</th>
              <th className="px-3 py-3">Due</th>
              <th className="px-3 py-3">Days PD</th>
              <th className="px-3 py-3">Totals</th>
              <th className="px-3 py-3">Paid</th>
              {BUCKET_KEYS.map((key) => (
                <th key={key} className={`px-3 py-3 ${BUCKET_CLASS[key]}`}>
                  {AGING_BUCKET_LABELS[key]}
                </th>
              ))}
              <th className="px-3 py-3">Total</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map(({ row, buckets, days }) => {
              const docNo = "invoiceNo" in row ? row.invoiceNo : row.billNo;
              return (
                <tr key={row.id} className="border-b border-border">
                  <td className="px-3 py-3 font-medium">{row.entityName}</td>
                  <td className="px-3 py-3">{docNo}</td>
                  <td className="px-3 py-3">
                    <Link href={`/loads/${row.loadId}`} className="text-primary">
                      {row.loadNumber}
                    </Link>
                    {row.referenceNumber ? (
                      <span className="block text-xs text-muted-foreground">{row.referenceNumber}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">{row.paymentTerms}</td>
                  <td className="px-3 py-3">{row.dueAt ? formatDate(row.dueAt) : "—"}</td>
                  <td className="px-3 py-3">{days}</td>
                  <td className="px-3 py-3">{formatMoney(row.totalCents)}</td>
                  <td className="px-3 py-3">{formatMoney(row.paidCents)}</td>
                  {BUCKET_KEYS.map((key) => (
                    <td key={key} className={`px-3 py-3 ${buckets[key] > 0 ? BUCKET_CLASS[key] : ""}`}>
                      {moneyOrBlank(buckets[key])}
                    </td>
                  ))}
                  <td className="px-3 py-3 font-semibold">{formatMoney(row.balanceCents)}</td>
                </tr>
              );
            })}
            {enriched.length === 0 ? (
              <tr>
                <td colSpan={14} className="px-3 py-8 text-center text-muted-foreground">
                  No open balances.
                </td>
              </tr>
            ) : (
              <tr className="bg-muted/30 font-semibold">
                <td className="px-3 py-3" colSpan={6}>
                  Totals
                </td>
                <td className="px-3 py-3">{formatMoney(totals.totalCents)}</td>
                <td className="px-3 py-3">{formatMoney(totals.paidCents)}</td>
                {BUCKET_KEYS.map((key) => (
                  <td key={key} className={`px-3 py-3 ${BUCKET_CLASS[key]}`}>
                    {moneyOrBlank(totals.buckets[key])}
                  </td>
                ))}
                <td className="px-3 py-3">{formatMoney(totals.balanceCents)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="border-t border-border px-4 py-3">
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
    </div>
  );
}

export function AccountingAgingReport({
  arRows,
  apRows
}: {
  arRows: AgingArRow[];
  apRows: AgingApRow[];
}) {
  return (
    <div className="grid gap-6">
      <AgingTable
        title="Accounts Receivable"
        rows={arRows}
        docLabel="Invoice #"
        manageHref="/accounting?tab=invoices"
        exportName="accounts-receivable.csv"
      />
      <AgingTable
        title="Accounts Payable"
        rows={apRows}
        docLabel="Bill #"
        manageHref="/accounting?tab=bills"
        exportName="accounts-payable.csv"
      />
    </div>
  );
}
