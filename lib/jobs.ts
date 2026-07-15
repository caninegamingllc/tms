import { prisma } from "@/lib/db";
import {
  getCompanyBranding,
  plainTextForType,
  persistGeneratedPdf,
  structuredDocumentForType
} from "@/lib/document-generate";
import type { StructuredDocument } from "@/lib/document-templates";
import { syncMailboxThreadsForUser } from "@/lib/mail/user-mailbox";

export type JobType = "GENERATE_PDF" | "SYNC_MAILBOX";

export type GeneratePdfPayload = {
  companyId: string;
  loadId: string;
  documentId: string;
  type: StructuredDocument["type"];
  documentNumber: string;
};

export type SyncMailboxPayload = {
  userId: string;
  companyId: string;
};

export async function enqueueJob(
  type: JobType,
  payload: GeneratePdfPayload | SyncMailboxPayload,
  options?: { availableAt?: Date; maxAttempts?: number }
) {
  return prisma.backgroundJob.create({
    data: {
      type,
      payloadJson: JSON.stringify(payload),
      availableAt: options?.availableAt ?? new Date(),
      maxAttempts: options?.maxAttempts ?? 5
    }
  });
}

async function processGeneratePdf(payload: GeneratePdfPayload) {
  const [company, load, document] = await Promise.all([
    getCompanyBranding(payload.companyId),
    prisma.load.findUniqueOrThrow({
      where: { id: payload.loadId },
      include: {
        customer: { include: { contacts: true } },
        stops: true,
        commodityLines: { orderBy: { sequence: "asc" } },
        charges: true,
        carrierPayLines: {
          orderBy: { sortOrder: "asc" },
          include: { lineType: true }
        },
        expenses: true,
        notes: { orderBy: { createdAt: "asc" } },
        dispatchAssignment: {
          include: {
            carrier: { include: { contacts: true } }
          }
        },
        invoices: { orderBy: { createdAt: "desc" } }
      }
    }),
    prisma.loadDocument.findUniqueOrThrow({ where: { id: payload.documentId } })
  ]);

  const structured = structuredDocumentForType(
    payload.type,
    load as never,
    payload.documentNumber,
    company
  );
  const pdf = await persistGeneratedPdf(payload.companyId, structured);
  const generatedContent = plainTextForType(
    payload.type,
    load as never,
    payload.documentNumber,
    company
  );

  await prisma.loadDocument.update({
    where: { id: document.id },
    data: {
      filePath: pdf.storedPath,
      mimeType: pdf.mimeType,
      originalFileName: pdf.originalFileName,
      fileSizeBytes: pdf.fileSizeBytes,
      generatedContent,
      generatedAt: new Date(),
      status: "PROCESSED"
    }
  });
}

async function processSyncMailbox(payload: SyncMailboxPayload) {
  await syncMailboxThreadsForUser(payload.userId, payload.companyId);
}

export async function processJob(job: { id: string; type: string; payloadJson: string }) {
  const payload = JSON.parse(job.payloadJson);
  switch (job.type) {
    case "GENERATE_PDF":
      await processGeneratePdf(payload as GeneratePdfPayload);
      break;
    case "SYNC_MAILBOX":
      await processSyncMailbox(payload as SyncMailboxPayload);
      break;
    default:
      throw new Error(`Unknown job type: ${job.type}`);
  }
}

export async function claimNextJob(workerId: string) {
  const now = new Date();
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      type: string;
      payloadJson: string;
      status: string;
      attempts: number;
      maxAttempts: number;
      availableAt: Date;
      lockedAt: Date | null;
      lockedBy: string | null;
      lastError: string | null;
      createdAt: Date;
      updatedAt: Date;
      completedAt: Date | null;
    }>
  >`
    UPDATE "BackgroundJob" AS job
    SET
      status = 'RUNNING',
      "lockedAt" = ${now},
      "lockedBy" = ${workerId},
      attempts = job.attempts + 1,
      "updatedAt" = ${now}
    WHERE job.id = (
      SELECT id
      FROM "BackgroundJob"
      WHERE status = 'PENDING'
        AND "availableAt" <= ${now}
      ORDER BY "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING *;
  `;

  return rows[0] ?? null;
}

export async function completeJob(jobId: string) {
  await prisma.backgroundJob.update({
    where: { id: jobId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      lastError: null
    }
  });
}

export async function failJob(jobId: string, error: unknown, maxAttempts: number, attempts: number) {
  const message = error instanceof Error ? error.message : String(error);
  const retry = attempts < maxAttempts;
  await prisma.backgroundJob.update({
    where: { id: jobId },
    data: {
      status: retry ? "PENDING" : "FAILED",
      availableAt: retry ? new Date(Date.now() + Math.min(60_000, attempts * 5_000)) : new Date(),
      lockedAt: null,
      lockedBy: null,
      lastError: message.slice(0, 2000)
    }
  });
}
