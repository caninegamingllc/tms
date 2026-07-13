"use client";

import Link from "next/link";
import { SortableTable } from "@/components/sortable-table";
import { StatusBadge } from "@/components/status-badge";
import { markInvoicePaid } from "@/lib/commission-actions";
import { formatDate, formatMoney } from "@/lib/format";

export type InvoiceTableRow = {
  id: string;
  invoiceNo: string;
  loadId: string;
  loadNumber: string;
  customerName: string;
  status: string;
  totalCents: number;
  dueAt: string | null;
  commissionCents: number | null;
  canMarkPaid: boolean;
};

export type CarrierBillTableRow = {
  id: string;
  billNo: string;
  loadNumber: string;
  carrierName: string;
  status: string;
  totalCents: number;
  dueAt: string | null;
};

export function InvoicesTable({ invoices }: { invoices: InvoiceTableRow[] }) {
  return (
    <SortableTable
      data={invoices}
      keyExtractor={(invoice) => invoice.id}
      defaultSort={{ columnId: "due", direction: "desc" }}
      columns={[
        {
          id: "invoice",
          label: "Invoice",
          sortValue: (invoice) => invoice.invoiceNo,
          render: (invoice) => <span className="font-semibold">{invoice.invoiceNo}</span>
        },
        {
          id: "load",
          label: "Load",
          sortValue: (invoice) => invoice.loadNumber,
          render: (invoice) => (
            <Link href={`/loads/${invoice.loadId}`} className="text-primary">
              {invoice.loadNumber}
            </Link>
          )
        },
        {
          id: "customer",
          label: "Customer",
          sortValue: (invoice) => invoice.customerName,
          render: (invoice) => invoice.customerName
        },
        {
          id: "status",
          label: "Status",
          sortValue: (invoice) => invoice.status,
          render: (invoice) => <StatusBadge value={invoice.status} />
        },
        {
          id: "total",
          label: "Total",
          sortValue: (invoice) => invoice.totalCents,
          render: (invoice) => formatMoney(invoice.totalCents)
        },
        {
          id: "due",
          label: "Due",
          sortValue: (invoice) => invoice.dueAt ?? "",
          render: (invoice) => (invoice.dueAt ? formatDate(invoice.dueAt) : "—")
        },
        {
          id: "actions",
          label: "Actions",
          sortable: false,
          render: (invoice) => (
            <div className="grid gap-2">
              {invoice.canMarkPaid ? (
                <form action={markInvoicePaid}>
                  <input type="hidden" name="invoiceId" value={invoice.id} />
                  <button type="submit" className="btn-secondary">
                    Mark Paid
                  </button>
                </form>
              ) : null}
              {invoice.commissionCents != null ? (
                <Link href="/commissions" className="text-sm font-semibold text-primary">
                  Commission {formatMoney(invoice.commissionCents)}
                </Link>
              ) : null}
            </div>
          )
        }
      ]}
    />
  );
}

export function CarrierBillsTable({ bills }: { bills: CarrierBillTableRow[] }) {
  return (
    <SortableTable
      data={bills}
      keyExtractor={(bill) => bill.id}
      defaultSort={{ columnId: "due", direction: "desc" }}
      columns={[
        {
          id: "bill",
          label: "Bill",
          sortValue: (bill) => bill.billNo,
          render: (bill) => <span className="font-semibold">{bill.billNo}</span>
        },
        {
          id: "load",
          label: "Load",
          sortValue: (bill) => bill.loadNumber,
          render: (bill) => bill.loadNumber
        },
        {
          id: "carrier",
          label: "Carrier",
          sortValue: (bill) => bill.carrierName,
          render: (bill) => bill.carrierName
        },
        {
          id: "status",
          label: "Status",
          sortValue: (bill) => bill.status,
          render: (bill) => <StatusBadge value={bill.status} />
        },
        {
          id: "total",
          label: "Total",
          sortValue: (bill) => bill.totalCents,
          render: (bill) => formatMoney(bill.totalCents)
        },
        {
          id: "due",
          label: "Due",
          sortValue: (bill) => bill.dueAt ?? "",
          render: (bill) => (bill.dueAt ? formatDate(bill.dueAt) : "—")
        }
      ]}
    />
  );
}
