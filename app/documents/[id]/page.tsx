import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentMetadataForm } from "@/components/document-metadata-form";
import { PageHeader } from "@/components/page-header";
import { PrintButton } from "@/components/print-button";
import { getBranchScope } from "@/lib/branch-filter-server";
import { requireTmsAccess } from "@/lib/permissions";
import { isPreviewableMimeType } from "@/lib/document-storage";
import { parseDocumentTypes } from "@/lib/document-types";
import { prisma } from "@/lib/db";
import { formatDateTime, humanize } from "@/lib/format";

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireTmsAccess();
  const scope = await getBranchScope(user);

  const [document, loads, customers, carriers, documentIds] = await Promise.all([
    prisma.loadDocument.findUnique({
      where: { id, companyId: user.companyId },
      include: {
        load: true,
        customer: true,
        carrier: true,
        uploadedBy: true
      }
    }),
    prisma.load.findMany({
      where: scope,
      orderBy: { loadNumber: "desc" },
      select: { id: true, loadNumber: true, pickupCity: true, pickupState: true, deliveryCity: true, deliveryState: true }
    }),
    prisma.customer.findMany({
      where: scope,
      orderBy: { name: "asc" },
      select: { id: true, name: true, city: true, state: true }
    }),
    prisma.carrier.findMany({
      where: scope,
      orderBy: { name: "asc" },
      select: { id: true, name: true, mcNumber: true }
    }),
    prisma.loadDocument.findMany({
      where: { companyId: user.companyId },
      orderBy: { uploadedAt: "desc" },
      select: { id: true }
    })
  ]);

  if (!document) {
    notFound();
  }

  const currentIndex = documentIds.findIndex((item) => item.id === document.id);
  const nextDocument = currentIndex >= 0 ? documentIds[currentIndex + 1] : undefined;

  const types = parseDocumentTypes(document.types);
  const hasFilePreview = Boolean(document.filePath && isPreviewableMimeType(document.mimeType));
  const isImage = document.mimeType?.startsWith("image/");

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title={document.name}
          description={`${humanize(document.type)} ${document.documentNumber ? `#${document.documentNumber}` : ""}`}
          action={
            <div className="flex flex-wrap gap-3">
              <Link href="/documents" className="btn-secondary">
                Back to document list
              </Link>
              {document.load ? (
                <Link href={`/loads/${document.load.id}`} className="btn-secondary">
                  Back to load
                </Link>
              ) : null}
              {document.filePath ? (
                <a href={`/api/documents/${document.id}/file?download=1`} className="btn-secondary">
                  Download
                </a>
              ) : null}
              {nextDocument ? (
                <Link href={`/documents/${nextDocument.id}`} className="btn-secondary">
                  Next document
                </Link>
              ) : null}
              {document.filePath || document.generatedContent ? <PrintButton /> : null}
            </div>
          }
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="card min-h-[70vh] overflow-hidden p-0">
          {hasFilePreview ? (
            <div className="h-full min-h-[70vh] bg-muted">
              {isImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/documents/${document.id}/file`}
                  alt={document.name}
                  className="h-full w-full object-contain"
                />
              ) : (
                <iframe
                  title={document.name}
                  src={`/api/documents/${document.id}/file`}
                  className="h-full min-h-[70vh] w-full"
                />
              )}
            </div>
          ) : document.generatedContent ? (
            <article className="p-8">
              <header className="border-b border-border pb-5">
                <p className="text-sm font-semibold uppercase tracking-wide text-primary">Generated Document</p>
                <h1 className="mt-2 text-2xl font-bold text-foreground">{document.name}</h1>
                <div className="mt-3 grid gap-1 text-sm text-muted-foreground md:grid-cols-2">
                  <p>Document Type: {humanize(document.type)}</p>
                  <p>Document #: {document.documentNumber ?? "Not assigned"}</p>
                  <p>Load: {document.load?.loadNumber ?? "Not linked"}</p>
                  <p>Generated: {formatDateTime(document.generatedAt ?? document.uploadedAt)}</p>
                </div>
              </header>
              <pre className="mt-6 whitespace-pre-wrap font-sans text-sm leading-7 text-foreground">
                {document.generatedContent}
              </pre>
            </article>
          ) : (
            <div className="p-8">
              <p className="font-semibold text-foreground">No preview available</p>
              <p className="mt-2 text-sm text-muted-foreground">
                This document does not have a previewable file attached yet.
              </p>
              {document.filePath ? (
                <p className="mt-3 text-sm text-slate-700">Stored path: {document.filePath}</p>
              ) : null}
            </div>
          )}
        </section>

        <section className="card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="section-title">Document Details</h2>
              <p className="muted">
                Uploaded by {document.uploadedBy?.name ?? "System"} on{" "}
                {formatDateTime(document.uploadedAt)}.
              </p>
            </div>
          </div>

          <DocumentMetadataForm
            documentId={document.id}
            defaultName={document.name}
            defaultNotes={document.notes}
            defaultTypes={types.length ? types : [document.type]}
            defaultLoadId={document.loadId ?? undefined}
            defaultCustomerId={document.customerId ?? undefined}
            defaultCarrierId={document.carrierId ?? undefined}
            defaultIsCompanyDocument={document.isCompanyDocument}
            loads={loads.map((load) => ({
              id: load.id,
              label: load.loadNumber,
              description: `${load.pickupCity}, ${load.pickupState} → ${load.deliveryCity}, ${load.deliveryState}`
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
      </div>
    </>
  );
}
