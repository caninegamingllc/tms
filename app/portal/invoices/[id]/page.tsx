import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomerPortalShell } from "@/components/customer-portal-shell";
import { StatusBadge } from "@/components/status-badge";
import { CUSTOMER_FACING_DOCUMENT_TYPES } from "@/lib/customer-board";
import { prisma } from "@/lib/db";
import { formatDate, formatDateTime, formatMoney, humanize } from "@/lib/format";
import { requirePortalViewer } from "@/lib/portal-auth";

export default async function PortalInvoiceDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requirePortalViewer();
  const { id } = await params;

  const invoice = await prisma.invoice.findFirst({
    where: {
      id,
      companyId: viewer.companyId,
      customerId: viewer.customerId,
      status: { not: "VOID" }
    },
    include: {
      load: {
        select: {
          id: true,
          loadNumber: true,
          documents: {
            where: { type: { in: ["INVOICE", ...CUSTOMER_FACING_DOCUMENT_TYPES] } },
            orderBy: { uploadedAt: "desc" },
            select: {
              id: true,
              type: true,
              name: true,
              filePath: true,
              uploadedAt: true
            }
          }
        }
      },
      customer: { select: { paymentUrl: true } },
      company: { select: { customerPaymentUrl: true } }
    }
  });

  if (!invoice) {
    notFound();
  }

  const paymentUrl = invoice.customer.paymentUrl ?? invoice.company.customerPaymentUrl;
  const showPay =
    Boolean(paymentUrl) &&
    invoice.balanceCents > 0 &&
    !["PAID", "VOID"].includes(invoice.status);

  const docs = invoice.load.documents.filter(
    (doc) => doc.type === "INVOICE" || CUSTOMER_FACING_DOCUMENT_TYPES.includes(doc.type as (typeof CUSTOMER_FACING_DOCUMENT_TYPES)[number])
  );

  return (
    <CustomerPortalShell viewer={viewer}>
      <div className="grid gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/portal/invoices" className="text-sm font-semibold text-primary">
              ← Back to invoices
            </Link>
            <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight">
              Invoice {invoice.invoiceNo}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Load{" "}
              <Link href={`/portal/loads/${invoice.load.id}`} className="text-primary">
                {invoice.load.loadNumber}
              </Link>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge value={invoice.status} />
            {showPay && paymentUrl ? (
              <a href={paymentUrl} target="_blank" rel="noreferrer" className="btn">
                Pay invoice
              </a>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-border bg-white p-4">
            <p className="label">Total</p>
            <p className="font-display text-2xl font-semibold">{formatMoney(invoice.totalCents)}</p>
          </div>
          <div className="rounded-2xl border border-border bg-white p-4">
            <p className="label">Balance</p>
            <p className="font-display text-2xl font-semibold">{formatMoney(invoice.balanceCents)}</p>
          </div>
          <div className="rounded-2xl border border-border bg-white p-4">
            <p className="label">Issued</p>
            <p className="font-semibold">{invoice.issuedAt ? formatDate(invoice.issuedAt) : "—"}</p>
          </div>
          <div className="rounded-2xl border border-border bg-white p-4">
            <p className="label">Due</p>
            <p className="font-semibold">{invoice.dueAt ? formatDate(invoice.dueAt) : "—"}</p>
          </div>
        </div>

        <section className="rounded-2xl border border-border bg-white p-5">
          <h2 className="section-title">Documents</h2>
          <div className="mt-4 grid gap-2">
            {docs.length ? (
              docs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-semibold">{doc.name}</p>
                    <p className="muted">
                      {humanize(doc.type)} · {formatDateTime(doc.uploadedAt)}
                    </p>
                  </div>
                  {doc.filePath ? (
                    <a
                      className="btn-secondary"
                      href={`/api/portal/documents/${doc.id}/file`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View
                    </a>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="muted">No invoice documents attached yet.</p>
            )}
          </div>
        </section>
      </div>
    </CustomerPortalShell>
  );
}
