import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { PrintButton } from "@/components/print-button";
import { prisma } from "@/lib/db";
import { formatDateTime, humanize } from "@/lib/format";

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const document = await prisma.loadDocument.findUnique({
    where: { id },
    include: {
      load: true,
      customer: true,
      carrier: true
    }
  });

  if (!document) {
    notFound();
  }

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title={document.name}
          description={`${humanize(document.type)} ${document.documentNumber ? `#${document.documentNumber}` : ""}`}
          action={
            <div className="flex flex-wrap gap-3">
              {document.load ? (
                <Link href={`/loads/${document.load.id}`} className="btn-secondary">
                  Back To Load
                </Link>
              ) : null}
              <PrintButton />
            </div>
          }
        />
      </div>

      <article className="mx-auto max-w-4xl rounded-2xl border border-border bg-white p-8 shadow-card print:border-0 print:p-0 print:shadow-none">
        <header className="border-b border-border pb-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">
            Freight Broker TMS
          </p>
          <h1 className="mt-2 text-3xl font-bold text-ink">{document.name}</h1>
          <div className="mt-3 grid gap-1 text-sm text-muted md:grid-cols-2">
            <p>Document Type: {humanize(document.type)}</p>
            <p>Document #: {document.documentNumber ?? "Not assigned"}</p>
            <p>Load: {document.load?.loadNumber ?? "Not linked"}</p>
            <p>Generated: {formatDateTime(document.generatedAt ?? document.uploadedAt)}</p>
            <p>Customer: {document.customer?.name ?? document.load?.pickupCity ?? "N/A"}</p>
            <p>Carrier: {document.carrier?.name ?? "N/A"}</p>
          </div>
        </header>

        {document.generatedContent ? (
          <pre className="mt-6 whitespace-pre-wrap font-sans text-sm leading-7 text-ink">
            {document.generatedContent}
          </pre>
        ) : (
          <div className="mt-6 rounded-2xl bg-soft p-5">
            <p className="font-semibold text-ink">Manual Document</p>
            <p className="mt-2 text-sm text-muted">
              This document was added manually and does not have generated preview content.
            </p>
            <p className="mt-3 text-sm text-slate-700">Path: {document.filePath ?? "No file path"}</p>
            <p className="mt-1 text-sm text-slate-700">Notes: {document.notes ?? "No notes"}</p>
          </div>
        )}
      </article>
    </>
  );
}
