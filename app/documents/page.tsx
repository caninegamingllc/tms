import { PageHeader } from "@/components/page-header";
import { DocumentsTable } from "@/components/documents-table";
import { addDocument } from "@/lib/actions";
import { requireTmsAccess } from "@/lib/permissions";
import { branchScopedWhere } from "@/lib/scope";
import { documentTypes } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { humanize } from "@/lib/format";

export default async function DocumentsPage() {
  const user = await requireTmsAccess();
  const loadScope = branchScopedWhere(user);
  const customerScope = branchScopedWhere(user);
  const [documents, loads, customers, carriers] = await Promise.all([
    prisma.loadDocument.findMany({
      where: {
        companyId: user.companyId,
        OR: [{ load: loadScope }, { customer: customerScope }, { carrier: { companyId: user.companyId } }]
      },
      orderBy: { uploadedAt: "desc" },
      include: { load: true, customer: true, carrier: true }
    }),
    prisma.load.findMany({ where: loadScope, orderBy: { loadNumber: "desc" } }),
    prisma.customer.findMany({ where: customerScope, orderBy: { name: "asc" } }),
    prisma.carrier.findMany({ where: { companyId: user.companyId }, orderBy: { name: "asc" } })
  ]);

  const rows = documents.map((document) => ({
    id: document.id,
    name: document.name,
    notes: document.notes ?? "No notes",
    type: document.type,
    linkedTo:
      document.load?.loadNumber ?? document.customer?.name ?? document.carrier?.name ?? "Unlinked",
    documentRef: document.documentNumber ?? document.filePath ?? "No file path",
    uploadedAt: document.uploadedAt.toISOString()
  }));

  return (
    <>
      <PageHeader
        title="Documents"
        description="Store and link BOLs, PODs, rate confirmations, invoices, insurance certificates, W-9s, and carrier packets."
      />

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.8fr]">
        <section className="card overflow-hidden p-0">
          <div className="border-b border-border p-5">
            <h2 className="section-title">Document Library</h2>
            <p className="muted">Documents can be linked to loads, customers, or carriers. Click column headers to sort.</p>
          </div>
          <div className="overflow-x-auto">
            <DocumentsTable documents={rows} />
          </div>
        </section>

        <section className="card">
          <h2 className="section-title">Add Document</h2>
          <p className="muted">
            For this local version, enter a file path. A production build can replace this with cloud
            storage.
          </p>
          <form action={addDocument} className="mt-4 grid gap-3">
            <select name="type" className="select">
              {documentTypes.map((type) => (
                <option key={type} value={type}>
                  {humanize(type)}
                </option>
              ))}
            </select>
            <input name="name" className="input" placeholder="Document name" required />
            <input name="filePath" className="input" placeholder="/uploads/rate-confirmation.pdf" />
            <textarea name="notes" className="textarea" placeholder="Notes" rows={3} />

            <div className="rounded-2xl bg-muted p-4">
              <p className="mb-3 text-sm font-semibold text-foreground">Optional Links</p>
              <div className="grid gap-3">
                <select name="loadId" className="select" defaultValue="">
                  <option value="">No load link</option>
                  {loads.map((load) => (
                    <option key={load.id} value={load.id}>
                      {load.loadNumber} - {load.title}
                    </option>
                  ))}
                </select>
                <select name="customerId" className="select" defaultValue="">
                  <option value="">No customer link</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
                <select name="carrierId" className="select" defaultValue="">
                  <option value="">No carrier link</option>
                  {carriers.map((carrier) => (
                    <option key={carrier.id} value={carrier.id}>
                      {carrier.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button className="btn" type="submit">
              Save Document
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
