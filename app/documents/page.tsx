import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { DocumentsTable } from "@/components/documents-table";
import { getBranchScope } from "@/lib/branch-filter-server";
import { toDocumentTableRows } from "@/lib/document-rows";
import { requireTmsAccess } from "@/lib/permissions";
import { prisma } from "@/lib/db";

export default async function DocumentsPage() {
  const user = await requireTmsAccess();
  const loadScope = await getBranchScope(user);
  const customerScope = loadScope;
  const documents = await prisma.loadDocument.findMany({
    where: {
      companyId: user.companyId,
      OR: [{ load: loadScope }, { customer: customerScope }, { carrier: loadScope }]
    },
    orderBy: { uploadedAt: "desc" },
    include: {
      load: true,
      customer: true,
      carrier: true,
      uploadedBy: true
    }
  });

  const rows = toDocumentTableRows(documents);

  return (
    <>
      <PageHeader
        title="Document Management and Search"
        description="Upload, label, and search documents attached to loads, customers, and carriers."
        action={
          <Link href="/documents/new" className="btn">
            + Upload a new doc
          </Link>
        }
      />

      <section className="card overflow-hidden p-0">
        <div className="border-b border-border p-5">
          <h2 className="section-title">Your Documents</h2>
          <p className="muted">
            Documents can be linked to loads, customers, or carriers. Click column headers to sort.
          </p>
        </div>
        <DocumentsTable documents={rows} />
      </section>
    </>
  );
}
