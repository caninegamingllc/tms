"use server";

import { readStoredFile } from "@/lib/document-storage";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { canAccessRecord } from "@/lib/branch-filter-server";
import { requireWriteUser, assertPlanFeature } from "@/lib/permissions";
import { planHasFeature } from "@/lib/plans";
import { getCompanyPlan } from "@/lib/seats";
import {
  buildPodRequestEmail,
  defaultEmailMessage,
  documentTitle,
  plainTextToHtml,
  type StructuredDocument
} from "@/lib/document-templates";
import {
  getCompanyBranding,
  persistGeneratedPdf,
  plainTextForType,
  structuredDocumentForType
} from "@/lib/document-generate";
import { parseDocumentTypes } from "@/lib/document-types";
import {
  type MailAttachment,
  sendViaUserMailbox,
  syncMailboxThreadsForUser
} from "@/lib/mail/user-mailbox";
import { generateDocumentPdf, pdfFilenameForDocument } from "@/lib/pdf-documents";
import { dueDateFromTerms } from "@/lib/accounting-aging";
import { enqueueJob } from "@/lib/jobs";
import { applyLateFeesForInvoiceSend } from "@/lib/late-fees-apply";
import {
  dispatchAssignmentsDocumentInclude,
  primaryAssignment
} from "@/lib/dispatch-assignment";
import { assertCarrierDocumentInsuranceReady } from "@/lib/carrier-compliance";

export type EmailPurpose =
  | "CARRIER_RATE_CONFIRMATION"
  | "CUSTOMER_LOAD_CONFIRMATION"
  | "INVOICE"
  | "BOL"
  | "POD_REQUEST";

export type EmailDraftAttachment = {
  id: string;
  name: string;
  kind: "primary" | "supporting";
  documentType?: string;
  required?: boolean;
};

export type EmailDraft = {
  purpose: EmailPurpose;
  loadId: string;
  loadNumber: string;
  fromAddress: string;
  to: string;
  subject: string;
  body: string;
  primaryAttachmentName: string | null;
  supportingDocuments: EmailDraftAttachment[];
  assignmentId?: string | null;
};

async function loadForEmail(loadId: string, user: SessionUser) {
  const load = await prisma.load.findUniqueOrThrow({
    where: { id: loadId, companyId: user.companyId },
    include: {
      customer: { include: { contacts: true } },
      stops: true,
      commodityLines: { orderBy: { sequence: "asc" } },
      charges: true,
      carrierPayLines: {
        orderBy: { sortOrder: "asc" },
        include: { lineType: true }
      },
      documents: { orderBy: { uploadedAt: "desc" } },
      dispatchAssignments: dispatchAssignmentsDocumentInclude,
      invoices: { orderBy: { createdAt: "desc" } },
      notes: { orderBy: { createdAt: "asc" } }
    }
  });

  if (!(await canAccessRecord(user, load.branchId))) {
    throw new Error("Load not found.");
  }

  return load;
}

async function nextDocumentNumber(companyId: string, prefix: string) {
  const count = await prisma.loadDocument.count({
    where: { companyId, documentNumber: { startsWith: prefix } }
  });
  return `${prefix}-${String(count + 1001).padStart(4, "0")}`;
}

async function nextInvoiceNumber(companyId: string) {
  const count = await prisma.invoice.count({ where: { companyId } });
  return `INV-${String(count + 1001).padStart(4, "0")}`;
}

function customerEmail(load: Awaited<ReturnType<typeof loadForEmail>>) {
  const primary = load.customer.contacts.find((contact) => contact.isPrimary);
  return (primary?.email || load.customer.email || "").trim();
}

function resolveCarrierAssignment(
  load: Awaited<ReturnType<typeof loadForEmail>>,
  assignmentId?: string | null
) {
  if (assignmentId) {
    return load.dispatchAssignments.find((row) => row.id === assignmentId) ?? null;
  }
  return (
    primaryAssignment(load.dispatchAssignments.filter((row) => row.carrierId)) ??
    primaryAssignment(load.dispatchAssignments)
  );
}

function carrierEmail(
  load: Awaited<ReturnType<typeof loadForEmail>>,
  assignmentId?: string | null
) {
  const carrier = resolveCarrierAssignment(load, assignmentId)?.carrier;
  const primary = carrier?.contacts.find((contact) => contact.isPrimary);
  return (primary?.email || carrier?.email || "").trim();
}

function purposeToDocType(purpose: EmailPurpose): StructuredDocument["type"] | null {
  switch (purpose) {
    case "CARRIER_RATE_CONFIRMATION":
      return "RATE_CONFIRMATION";
    case "CUSTOMER_LOAD_CONFIRMATION":
      return "CUSTOMER_LOAD_CONFIRMATION";
    case "INVOICE":
      return "INVOICE";
    case "BOL":
      return "BOL";
    case "POD_REQUEST":
      return null;
  }
}

function docTypePrefix(type: StructuredDocument["type"]) {
  switch (type) {
    case "RATE_CONFIRMATION":
      return "RC";
    case "CUSTOMER_LOAD_CONFIRMATION":
      return "CLC";
    case "BOL":
      return "BOL";
    case "INVOICE":
      return "INV";
  }
}

function isSupportingDocType(type: string, typesJson?: string | null) {
  const all = new Set([type, ...parseDocumentTypes(typesJson)]);
  return all.has("BOL") || all.has("POD");
}

function supportingDocsForInvoice(load: Awaited<ReturnType<typeof loadForEmail>>) {
  return load.documents.filter((document) => {
    if (!document.filePath) {
      return false;
    }
    if (document.customerId !== load.customerId) {
      return false;
    }
    return isSupportingDocType(document.type, document.types);
  });
}

async function ensurePrimaryDocument(
  purpose: EmailPurpose,
  load: Awaited<ReturnType<typeof loadForEmail>>,
  user: SessionUser,
  assignmentId?: string | null
) {
  const docType = purposeToDocType(purpose);
  if (!docType) {
    return { document: null as null, invoiceId: undefined as string | undefined };
  }

  const company = await getCompanyBranding(user.companyId);
  let invoiceId: string | undefined;
  const assignment = resolveCarrierAssignment(load, assignmentId);

  if (docType === "INVOICE") {
    let invoice = load.invoices[0];
    if (!invoice) {
      const invoiceNumber = await nextInvoiceNumber(user.companyId);
      const issuedAt = new Date();
      const dueAt = dueDateFromTerms(issuedAt, load.customer.paymentTerms);
      invoice = await prisma.invoice.create({
        data: {
          companyId: user.companyId,
          invoiceNo: invoiceNumber,
          loadId: load.id,
          customerId: load.customerId,
          status: "DRAFT",
          totalCents: load.revenueCents,
          balanceCents: load.revenueCents,
          issuedAt,
          dueAt
        }
      });
    }
    invoiceId = invoice.id;
    load = await loadForEmail(load.id, user);
  }

  let document =
    docType === "RATE_CONFIRMATION" && assignment
      ? load.documents.find(
          (item) =>
            item.type === docType &&
            (item.assignmentId === assignment.id ||
              (!item.assignmentId && item.carrierId === assignment.carrierId))
        )
      : load.documents.find((item) => item.type === docType);

  if (!document) {
    if (docType === "RATE_CONFIRMATION" && assignment?.carrierId) {
      const carrier = await prisma.carrier.findUniqueOrThrow({
        where: { id: assignment.carrierId, companyId: user.companyId },
        include: {
          insuranceCoverages: {
            select: {
              coverageType: true,
              insurerName: true,
              policyNumber: true,
              expiresAt: true
            }
          }
        }
      });
      assertCarrierDocumentInsuranceReady(carrier.name, carrier.insuranceCoverages);
    }

    if (docType === "BOL") {
      const carrierIds = [
        ...new Set(
          load.dispatchAssignments.map((row) => row.carrierId).filter(Boolean) as string[]
        )
      ];
      for (const carrierId of carrierIds) {
        const carrier = await prisma.carrier.findUniqueOrThrow({
          where: { id: carrierId, companyId: user.companyId },
          include: {
            insuranceCoverages: {
              select: {
                coverageType: true,
                insurerName: true,
                policyNumber: true,
                expiresAt: true
              }
            }
          }
        });
        assertCarrierDocumentInsuranceReady(carrier.name, carrier.insuranceCoverages);
      }
    }

    const documentNumber =
      docType === "INVOICE"
        ? load.invoices[0]?.invoiceNo ?? (await nextInvoiceNumber(user.companyId))
        : docType === "BOL"
          ? `BOL-${load.loadNumber}`
          : await nextDocumentNumber(user.companyId, docTypePrefix(docType));

    const structured = structuredDocumentForType(
      docType,
      load,
      documentNumber,
      company,
      assignment?.id
    );
    const pdf = await persistGeneratedPdf(user.companyId, structured);

    document = await prisma.loadDocument.create({
      data: {
        companyId: user.companyId,
        loadId: load.id,
        customerId:
          docType === "RATE_CONFIRMATION" ? undefined : load.customerId,
        carrierId: assignment?.carrierId,
        assignmentId: docType === "RATE_CONFIRMATION" ? assignment?.id : undefined,
        type: docType,
        name: documentTitle(docType, load.loadNumber),
        documentNumber,
        generatedContent: plainTextForType(
          docType,
          load,
          documentNumber,
          company,
          assignment?.id
        ),
        generatedAt: new Date(),
        filePath: pdf.storedPath,
        mimeType: pdf.mimeType,
        originalFileName: pdf.originalFileName,
        fileSizeBytes: pdf.fileSizeBytes,
        notes: `Generated ${docType.toLowerCase().replace(/_/g, " ")} for email.`
      }
    });
  } else if (!document.filePath) {
    const documentNumber =
      document.documentNumber ??
      (docType === "BOL"
        ? `BOL-${load.loadNumber}`
        : await nextDocumentNumber(user.companyId, docTypePrefix(docType)));
    const structured = structuredDocumentForType(
      docType,
      load,
      documentNumber,
      company,
      assignment?.id ?? document.assignmentId
    );
    const pdf = await persistGeneratedPdf(user.companyId, structured);
    document = await prisma.loadDocument.update({
      where: { id: document.id },
      data: {
        generatedContent: plainTextForType(
          docType,
          load,
          documentNumber,
          company,
          assignment?.id ?? document.assignmentId
        ),
        generatedAt: new Date(),
        filePath: pdf.storedPath,
        mimeType: pdf.mimeType,
        originalFileName: pdf.originalFileName,
        fileSizeBytes: pdf.fileSizeBytes,
        assignmentId: document.assignmentId ?? assignment?.id
      }
    });
  }

  return { document, invoiceId };
}

async function attachmentFromDocument(document: {
  id: string;
  name: string;
  filePath: string | null;
  mimeType: string | null;
  originalFileName: string | null;
  type: string;
  documentNumber: string | null;
}): Promise<MailAttachment | null> {
  if (!document.filePath) {
    return null;
  }
  const content = await readStoredFile(document.filePath);
  return {
    filename:
      document.originalFileName ||
      `${document.type.toLowerCase()}-${document.documentNumber ?? document.id}.pdf`,
    contentType: document.mimeType || "application/pdf",
    content
  };
}

async function recordOutboundEmail(input: {
  user: SessionUser;
  loadId: string;
  purpose: string;
  subject: string;
  text: string;
  to: string;
  documentId?: string;
  invoiceId?: string;
  attachments?: MailAttachment[];
}) {
  const sent = await sendViaUserMailbox({
    userId: input.user.id,
    to: [input.to],
    subject: input.subject,
    text: input.text,
    html: plainTextToHtml(input.text),
    attachments: input.attachments
  });

  const attachmentNote = input.attachments?.length
    ? ` [${input.attachments.map((item) => item.filename).join(", ")}]`
    : "";

  const thread = await prisma.emailThread.create({
    data: {
      companyId: input.user.companyId,
      loadId: input.loadId,
      userId: input.user.id,
      purpose: input.purpose,
      subject: input.subject,
      provider: sent.provider,
      providerThreadId: sent.providerThreadId,
      documentId: input.documentId,
      invoiceId: input.invoiceId,
      messages: {
        create: {
          userId: input.user.id,
          direction: "OUTBOUND",
          fromAddress: sent.fromAddress,
          toAddresses: input.to,
          subject: input.subject,
          bodyPreview: input.text.slice(0, 280),
          bodyText: input.text + attachmentNote,
          providerMessageId: sent.providerMessageId,
          sentAt: new Date()
        }
      }
    }
  });

  await prisma.loadActivity.create({
    data: {
      loadId: input.loadId,
      userId: input.user.id,
      action: "Email sent",
      details: `${input.purpose}: ${input.subject} → ${input.to}${attachmentNote}`
    }
  });

  return thread;
}

export async function prepareEmailDraft(
  loadId: string,
  purpose: EmailPurpose,
  assignmentId?: string | null
): Promise<EmailDraft> {
  const user = await requireWriteUser();
  const load = await loadForEmail(loadId, user);
  const company = await getCompanyBranding(user.companyId);
  const mailbox = await prisma.userMailbox.findFirst({
    where: { userId: user.id, status: "CONNECTED" }
  });

  if (!mailbox) {
    throw new Error("Connect your Gmail or Microsoft mailbox in Settings > Email before sending.");
  }

  if (purpose === "CARRIER_RATE_CONFIRMATION" || purpose === "POD_REQUEST") {
    const assignment = resolveCarrierAssignment(load, assignmentId);
    if (!assignment?.carrierId) {
      throw new Error(
        purpose === "POD_REQUEST"
          ? "Assign a carrier before requesting a POD."
          : "Assign a carrier before emailing a rate confirmation."
      );
    }
  }

  const to =
    purpose === "CARRIER_RATE_CONFIRMATION" || purpose === "POD_REQUEST"
      ? carrierEmail(load, assignmentId)
      : customerEmail(load);

  if (!to) {
    throw new Error(
      purpose === "CARRIER_RATE_CONFIRMATION" || purpose === "POD_REQUEST"
        ? "Carrier has no email address on file."
        : "Customer has no email address on file."
    );
  }

  const { document } = await ensurePrimaryDocument(purpose, load, user, assignmentId);
  const refreshed = await loadForEmail(loadId, user);

  let subject = "";
  let primaryAttachmentName: string | null = null;
  const supportingDocuments: EmailDraftAttachment[] = [];

  switch (purpose) {
    case "CARRIER_RATE_CONFIRMATION":
      subject = `Rate Confirmation ${load.loadNumber} - ${document?.documentNumber ?? ""}`.trim();
      primaryAttachmentName = document?.originalFileName ?? `rate-confirmation-${load.loadNumber}.pdf`;
      break;
    case "CUSTOMER_LOAD_CONFIRMATION":
      subject = `Load Confirmation ${load.loadNumber} - ${document?.documentNumber ?? ""}`.trim();
      primaryAttachmentName = document?.originalFileName ?? `load-confirmation-${load.loadNumber}.pdf`;
      break;
    case "INVOICE": {
      const invoice = refreshed.invoices[0];
      subject = `Invoice ${invoice?.invoiceNo ?? document?.documentNumber ?? ""} for load ${load.loadNumber}`;
      primaryAttachmentName = document?.originalFileName ?? `invoice-${load.loadNumber}.pdf`;
      for (const supporting of supportingDocsForInvoice(refreshed)) {
        supportingDocuments.push({
          id: supporting.id,
          name: supporting.originalFileName || supporting.name,
          kind: "supporting",
          documentType: supporting.type
        });
      }
      break;
    }
    case "BOL":
      subject = `Bill of Lading ${load.loadNumber} - ${document?.documentNumber ?? ""}`.trim();
      primaryAttachmentName = document?.originalFileName ?? `bol-${load.loadNumber}.pdf`;
      break;
    case "POD_REQUEST":
      subject = `POD Request - Load ${load.loadNumber}`;
      primaryAttachmentName = null;
      break;
  }

  return {
    purpose,
    loadId,
    loadNumber: load.loadNumber,
    fromAddress: mailbox.emailAddress,
    to,
    subject,
    body:
      purpose === "POD_REQUEST"
        ? buildPodRequestEmail(load, mailbox.emailAddress || user.email)
        : defaultEmailMessage(purpose, load.loadNumber, company.name),
    primaryAttachmentName,
    supportingDocuments,
    assignmentId: assignmentId ?? null
  };
}

async function regenerateInvoiceDocument(
  load: Awaited<ReturnType<typeof loadForEmail>>,
  user: SessionUser,
  existing:
    | {
        id: string;
        documentNumber: string | null;
        type: string;
      }
    | null
    | undefined
) {
  const company = await getCompanyBranding(user.companyId);
  const documentNumber =
    existing?.documentNumber ??
    load.invoices[0]?.invoiceNo ??
    (await nextInvoiceNumber(user.companyId));
  const structured = structuredDocumentForType("INVOICE", load, documentNumber, company);
  const pdf = await persistGeneratedPdf(user.companyId, structured);

  if (existing?.id) {
    return prisma.loadDocument.update({
      where: { id: existing.id },
      data: {
        documentNumber,
        generatedContent: plainTextForType("INVOICE", load, documentNumber, company),
        generatedAt: new Date(),
        filePath: pdf.storedPath,
        mimeType: pdf.mimeType,
        originalFileName: pdf.originalFileName,
        fileSizeBytes: pdf.fileSizeBytes,
        notes: "Regenerated invoice after late fee applied."
      }
    });
  }

  return prisma.loadDocument.create({
    data: {
      companyId: user.companyId,
      loadId: load.id,
      customerId: load.customerId,
      type: "INVOICE",
      name: documentTitle("INVOICE", load.loadNumber),
      documentNumber,
      generatedContent: plainTextForType("INVOICE", load, documentNumber, company),
      generatedAt: new Date(),
      filePath: pdf.storedPath,
      mimeType: pdf.mimeType,
      originalFileName: pdf.originalFileName,
      fileSizeBytes: pdf.fileSizeBytes,
      notes: "Generated invoice for email after late fee applied."
    }
  });
}

export async function sendPreparedEmail(formData: FormData) {
  const user = await requireWriteUser();
  await assertPlanFeature(user.companyId, "email_ops");
  const loadId = String(formData.get("loadId") ?? "").trim();
  const purpose = String(formData.get("purpose") ?? "").trim() as EmailPurpose;
  const to = String(formData.get("to") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!loadId || !purpose || !to || !subject || !body) {
    throw new Error("Email fields are required.");
  }

  let load = await loadForEmail(loadId, user);
  const assignmentId = String(formData.get("assignmentId") ?? "").trim() || null;
  const ensured = await ensurePrimaryDocument(purpose, load, user, assignmentId);
  let document = ensured.document;
  const invoiceId = ensured.invoiceId;

  if (purpose === "INVOICE" && invoiceId) {
    const plan = await getCompanyPlan(user.companyId);
    if (planHasFeature(plan, "late_fees")) {
      const { feesApplied } = await applyLateFeesForInvoiceSend({ loadId, invoiceId });
      if (feesApplied > 0) {
        load = await loadForEmail(loadId, user);
        document = await regenerateInvoiceDocument(load, user, document);
      }
    }
  }

  const attachments: MailAttachment[] = [];

  if (document) {
    const primary = await attachmentFromDocument(document);
    if (primary) {
      attachments.push(primary);
    } else {
      const company = await getCompanyBranding(user.companyId);
      const docType = purposeToDocType(purpose);
      if (docType) {
        const structured = structuredDocumentForType(
          docType,
          load,
          document.documentNumber ?? "DOC",
          company
        );
        const pdfBuffer = await generateDocumentPdf(structured);
        attachments.push({
          filename: pdfFilenameForDocument(structured),
          contentType: "application/pdf",
          content: pdfBuffer
        });
      }
    }
  }

  if (purpose === "INVOICE") {
    const selectedIds = new Set(
      formData
        .getAll("supportingDocumentIds")
        .map((value) => String(value).trim())
        .filter(Boolean)
    );
    const refreshed = await loadForEmail(loadId, user);
    for (const supporting of supportingDocsForInvoice(refreshed)) {
      if (!selectedIds.has(supporting.id)) {
        continue;
      }
      const attachment = await attachmentFromDocument(supporting);
      if (attachment) {
        attachments.push(attachment);
      }
    }
  }

  await recordOutboundEmail({
    user,
    loadId,
    purpose,
    subject,
    text: body,
    to,
    documentId: document?.id,
    invoiceId,
    attachments: attachments.length ? attachments : undefined
  });

  if (invoiceId) {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: "SENT",
        issuedAt: new Date()
      }
    });

    if (purpose === "INVOICE") {
      const loadRow = await prisma.load.findFirst({
        where: { id: loadId, companyId: user.companyId },
        select: { status: true }
      });
      if (loadRow && !["PAID", "CANCELED", "INVOICED"].includes(loadRow.status)) {
        await prisma.load.update({
          where: { id: loadId },
          data: {
            status: "INVOICED",
            activities: {
              create: {
                userId: user.id,
                action: "Status changed",
                details: "Load moved to INVOICED after invoice was emailed."
              }
            }
          }
        });
      }
    }
  }

  revalidatePath(`/loads/${loadId}`);
  revalidatePath("/documents");
  revalidatePath("/accounting");
  revalidatePath("/");
  revalidatePath("/dispatch");
  revalidatePath("/loads");
  if (String(formData.get("skipRedirect") ?? "").trim() === "1") {
    return;
  }

  const redirectKey =
    purpose === "CARRIER_RATE_CONFIRMATION"
      ? "rate-confirmation"
      : purpose === "CUSTOMER_LOAD_CONFIRMATION"
        ? "customer-load-confirmation"
        : purpose === "INVOICE"
          ? "invoice"
          : purpose === "BOL"
            ? "bol"
            : "pod-request";

  redirect(`/loads/${loadId}?emailed=${redirectKey}`);
}

/** Legacy one-click wrappers kept for compatibility — prefer prepareEmailDraft + sendPreparedEmail. */
export async function emailRateConfirmation(formData: FormData) {
  const loadId = String(formData.get("loadId") ?? "").trim();
  const draft = await prepareEmailDraft(loadId, "CARRIER_RATE_CONFIRMATION");
  const sendData = new FormData();
  sendData.set("loadId", draft.loadId);
  sendData.set("purpose", draft.purpose);
  sendData.set("to", draft.to);
  sendData.set("subject", draft.subject);
  sendData.set("body", draft.body);
  await sendPreparedEmail(sendData);
}

export async function emailCustomerLoadConfirmation(formData: FormData) {
  const loadId = String(formData.get("loadId") ?? "").trim();
  const draft = await prepareEmailDraft(loadId, "CUSTOMER_LOAD_CONFIRMATION");
  const sendData = new FormData();
  sendData.set("loadId", draft.loadId);
  sendData.set("purpose", draft.purpose);
  sendData.set("to", draft.to);
  sendData.set("subject", draft.subject);
  sendData.set("body", draft.body);
  await sendPreparedEmail(sendData);
}

export async function emailInvoice(formData: FormData) {
  const loadId = String(formData.get("loadId") ?? "").trim();
  const draft = await prepareEmailDraft(loadId, "INVOICE");
  const sendData = new FormData();
  sendData.set("loadId", draft.loadId);
  sendData.set("purpose", draft.purpose);
  sendData.set("to", draft.to);
  sendData.set("subject", draft.subject);
  sendData.set("body", draft.body);
  for (const supporting of draft.supportingDocuments) {
    sendData.append("supportingDocumentIds", supporting.id);
  }
  await sendPreparedEmail(sendData);
}

export async function emailBol(formData: FormData) {
  const loadId = String(formData.get("loadId") ?? "").trim();
  const draft = await prepareEmailDraft(loadId, "BOL");
  const sendData = new FormData();
  sendData.set("loadId", draft.loadId);
  sendData.set("purpose", draft.purpose);
  sendData.set("to", draft.to);
  sendData.set("subject", draft.subject);
  sendData.set("body", draft.body);
  await sendPreparedEmail(sendData);
}

export async function emailPodRequest(formData: FormData) {
  const loadId = String(formData.get("loadId") ?? "").trim();
  const draft = await prepareEmailDraft(loadId, "POD_REQUEST");
  const sendData = new FormData();
  sendData.set("loadId", draft.loadId);
  sendData.set("purpose", draft.purpose);
  sendData.set("to", draft.to);
  sendData.set("subject", draft.subject);
  sendData.set("body", draft.body);
  await sendPreparedEmail(sendData);
}

export async function generateCustomerLoadConfirmation(formData: FormData) {
  const user = await requireWriteUser();
  await assertPlanFeature(user.companyId, "generate_load_con");
  const loadId = String(formData.get("loadId") ?? "").trim();
  const load = await loadForEmail(loadId, user);
  const documentNumber = await nextDocumentNumber(user.companyId, "CLC");
  const company = await getCompanyBranding(user.companyId);

  const document = await prisma.loadDocument.create({
    data: {
      companyId: user.companyId,
      loadId: load.id,
      customerId: load.customerId,
      type: "CUSTOMER_LOAD_CONFIRMATION",
      name: documentTitle("CUSTOMER_LOAD_CONFIRMATION", load.loadNumber),
      documentNumber,
      generatedContent: plainTextForType(
        "CUSTOMER_LOAD_CONFIRMATION",
        load,
        documentNumber,
        company
      ),
      status: "PROCESSING",
      notes: "Generated customer load confirmation."
    }
  });

  await enqueueJob("GENERATE_PDF", {
    companyId: user.companyId,
    loadId: load.id,
    documentId: document.id,
    type: "CUSTOMER_LOAD_CONFIRMATION",
    documentNumber
  });

  await prisma.loadActivity.create({
    data: {
      loadId,
      userId: user.id,
      action: "Customer load confirmation queued",
      details: documentNumber
    }
  });

  revalidatePath("/documents");
  revalidatePath(`/loads/${loadId}`);
  redirect(`/documents/${document.id}`);
}

export async function syncLoadEmails(formData: FormData) {
  const user = await requireWriteUser();
  const loadId = String(formData.get("loadId") ?? "").trim();
  await loadForEmail(loadId, user);
  try {
    // Sync inline (same as Settings → Email) so replies appear on revalidate.
    await syncMailboxThreadsForUser(user.id, user.companyId);
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message.slice(0, 240)
        : "Mailbox sync failed. Check Email settings and try again.";
    redirect(`/loads/${loadId}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath(`/loads/${loadId}`);
}
