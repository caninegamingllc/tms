import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentUploadForm } from "@/components/document-upload-form";
import { DocumentsTable } from "@/components/documents-table";
import { PageHeader } from "@/components/page-header";
import { canAccessRecord } from "@/lib/branch-filter-server";
import { requireTmsAccess } from "@/lib/permissions";
import { toDocumentTableRows } from "@/lib/document-rows";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/format";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireTmsAccess();
  const customer = await prisma.customer.findUnique({
    where: { id, companyId: user.companyId },
    include: {
      branch: true,
      contacts: true,
      loads: { select: { id: true } },
      invoices: true,
      documents: { include: { uploadedBy: true, load: true, customer: true, carrier: true } }
    }
  });

  if (!customer || !(await canAccessRecord(user, customer.branchId))) {
    notFound();
  }

  const primaryContact = customer.contacts.find((contact) => contact.isPrimary) ?? customer.contacts[0];
  const openAr = customer.invoices
    .filter((invoice) => invoice.status !== "PAID" && invoice.status !== "VOID")
    .reduce((sum, invoice) => sum + invoice.totalCents, 0);

  return (
    <>
      <PageHeader
        title={customer.name}
        description="Customer profile, account summary, and customer-specific documents."
        action={
          <Link href="/customers" className="btn-secondary">
            Back to customers
          </Link>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="card">
          <h2 className="section-title">Customer Summary</h2>
          <div className="mt-4 grid gap-3 rounded-2xl bg-muted p-4 text-sm">
            <div>
              <p className="label">Location</p>
              <p className="font-semibold text-foreground">
                {customer.city ?? "No city"}, {customer.state ?? "No state"}
              </p>
            </div>
            <div>
              <p className="label">Branch</p>
              <p className="font-semibold text-foreground">{customer.branch?.name ?? "Unassigned"}</p>
            </div>
            <div>
              <p className="label">Primary Contact</p>
              <p className="font-semibold text-foreground">{primaryContact?.name ?? "No contact"}</p>
              <p className="muted">{primaryContact?.email ?? customer.email ?? "No email"}</p>
            </div>
            <div>
              <p className="label">Payment Terms</p>
              <p className="font-semibold text-foreground">{customer.paymentTerms}</p>
            </div>
            <div>
              <p className="label">Credit Limit</p>
              <p className="font-semibold text-foreground">{formatMoney(customer.creditLimit)}</p>
            </div>
            <div>
              <p className="label">Loads / Open AR</p>
              <p className="font-semibold text-foreground">
                {customer.loads.length} loads - {formatMoney(openAr)} open AR
              </p>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="section-title">Customer Documents</h2>
              <p className="muted">Upload contracts, credit applications, and other customer-specific paperwork.</p>
            </div>
            <Link href="/documents/new" className="btn-secondary">
              Upload in document library
            </Link>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-border">
            <DocumentsTable
              documents={toDocumentTableRows(customer.documents)}
              showFilter={false}
              compact
            />
          </div>

          <div className="mt-5 rounded-2xl bg-muted p-4">
            <p className="mb-3 text-sm font-semibold text-foreground">Upload Customer Document</p>
            <DocumentUploadForm
              defaultCustomerId={customer.id}
              showEntityPickers={false}
              submitLabel="Add Document"
            />
          </div>
        </section>
      </div>
    </>
  );
}
