import Link from "next/link";
import { DocumentUploadForm } from "@/components/document-upload-form";
import { PageHeader } from "@/components/page-header";
import { requireTmsAccess } from "@/lib/permissions";
import { branchScopedWhere } from "@/lib/scope";
import { prisma } from "@/lib/db";

export default async function NewDocumentPage() {
  const user = await requireTmsAccess();
  const loadScope = branchScopedWhere(user);
  const customerScope = branchScopedWhere(user);
  const [loads, customers, carriers] = await Promise.all([
    prisma.load.findMany({
      where: loadScope,
      orderBy: { loadNumber: "desc" },
      select: { id: true, loadNumber: true, title: true }
    }),
    prisma.customer.findMany({
      where: customerScope,
      orderBy: { name: "asc" },
      select: { id: true, name: true, city: true, state: true }
    }),
    prisma.carrier.findMany({
      where: { companyId: user.companyId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, mcNumber: true }
    })
  ]);

  return (
    <>
      <PageHeader
        title="Upload Document"
        description="Upload a document and attach it to a load, customer, carrier, or keep it as a company document."
        action={
          <Link href="/documents" className="btn-secondary">
            Back to document list
          </Link>
        }
      />

      <section className="card">
        <DocumentUploadForm
          loads={loads.map((load) => ({
            id: load.id,
            label: load.loadNumber,
            description: load.title
          }))}
          customers={customers.map((customer) => ({
            id: customer.id,
            label: customer.name,
            description: `${customer.city ?? ""} ${customer.state ?? ""}`.trim()
          }))}
          carriers={carriers.map((carrier) => ({
            id: carrier.id,
            label: carrier.name,
            description: carrier.mcNumber ?? undefined
          }))}
        />
      </section>
    </>
  );
}
