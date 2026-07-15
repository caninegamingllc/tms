import Link from "next/link";
import { CustomerPortalShell } from "@/components/customer-portal-shell";
import { StatusBadge } from "@/components/status-badge";
import { prisma } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";
import { requirePortalViewer } from "@/lib/portal-auth";

export default async function PortalInvoicesPage() {
  const viewer = await requirePortalViewer();
  const invoices = await prisma.invoice.findMany({
    where: {
      companyId: viewer.companyId,
      customerId: viewer.customerId,
      status: { not: "VOID" }
    },
    include: {
      load: { select: { id: true, loadNumber: true } }
    },
    orderBy: [{ issuedAt: "desc" }, { createdAt: "desc" }]
  });

  return (
    <CustomerPortalShell viewer={viewer}>
      <div className="grid gap-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Accounting
          </p>
          <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight">Invoices</h1>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border bg-muted text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Invoice</th>
                <th className="px-4 py-3 font-semibold">Load</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Issued</th>
                <th className="px-4 py-3 font-semibold">Due</th>
                <th className="px-4 py-3 font-semibold">Total</th>
                <th className="px-4 py-3 font-semibold">Balance</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-b border-border/70">
                  <td className="px-4 py-3">
                    <Link href={`/portal/invoices/${invoice.id}`} className="font-semibold text-primary">
                      {invoice.invoiceNo}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/portal/loads/${invoice.load.id}`} className="text-primary">
                      {invoice.load.loadNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge value={invoice.status} />
                  </td>
                  <td className="px-4 py-3">{invoice.issuedAt ? formatDate(invoice.issuedAt) : "—"}</td>
                  <td className="px-4 py-3">{invoice.dueAt ? formatDate(invoice.dueAt) : "—"}</td>
                  <td className="px-4 py-3">{formatMoney(invoice.totalCents)}</td>
                  <td className="px-4 py-3 font-semibold">{formatMoney(invoice.balanceCents)}</td>
                </tr>
              ))}
              {!invoices.length ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No invoices yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </CustomerPortalShell>
  );
}
