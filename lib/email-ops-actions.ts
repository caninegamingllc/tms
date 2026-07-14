"use server";

import { readFile } from "fs/promises";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { canAccessRecord } from "@/lib/branch-filter-server";
import { requireWriteUser } from "@/lib/permissions";
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
import { getAbsolutePath } from "@/lib/document-storage";
import { type MailAttachment, sendViaUserMailbox } from "@/lib/mail/user-mailbox";
import { generateDocumentPdf, pdfFilenameForDocument } from "@/lib/pdf-documents";

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
};

async function loadForEmail(loadId: string, user: SessionUser) {
  const load = await prisma.load.findUniqueOrThrow({
    where: { id: loadId, companyId: user.companyId },
    include: {
      customer: { include: { contacts: true } },
      stops: true,
      charges: true,
      carrierPayLines: {
        orderBy: { sortOrder: "asc" },
        include: { lineType: true }
      },
      documents: { orderBy: { uploadedAt: "desc" } },
      dispatchAssignment: {
        include: {
          carrier: { include: { contacts: true } }
        }
      },
      invoices: { orderBy: { createdAt: "desc" } }
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

function carrierEmail(load: Awaited<ReturnType<typeof loadForEmail>>) {
  const carrier = load.dispatchAssignment?.carrier;
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
  user: SessionUser
) {
  const docType = purposeToDocType(purpose);
  if (!docType) {
    return { document: null as null, invoiceId: undefined as string | undefined };
  }

  const company = await getCompanyBranding(user.companyId);
  let invoiceId: string | undefined;

  if (docType === "INVOICE") {
    let invoice = load.invoices[0];
    if (!invoice) {
      const invoiceNumber = await nextInvoiceNumber(user.companyId);
      const issuedAt = new Date();
      const dueAt = new Date();
      dueAt.setDate(dueAt.getDate() + 30);
      invoice = await prisma.invoice.create({
        data: {
          companyId: user.companyId,
          invoiceNo: invoiceNumber,
          loadId: load.id,
          customerId: load.customerId,
          status: "DRAFT",
          totalCents: load.revenueCents,
          issuedAt,
          dueAt
        }
      });
    }
    invoiceId = invoice.id;
    load = await loadForEmail(load.id, user);
  }

  let document = load.documents.find((item) => item.type === docType);
  if (!document) {
    const documentNumber =
      docType === "INVOICE"
        ? load.invoices[0]?.invoiceNo ?? (await nextInvoiceNumber(user.companyId))
        : await nextDocumentNumber(user.companyId, docTypePrefix(docType));

    const structured = structuredDocumentForType(docType, load, documentNumber, company);
    const pdf = await persistGeneratedPdf(user.companyId, structured);

    document = await prisma.loadDocument.create({
      data: {
        companyId: user.companyId,
        loadId: load.id,
        customerId:
          docType === "RATE_CONFIRMATION" ? undefined : load.customerId,
        carrierId: load.dispatchAssignment?.carrierId,
        type: docType,
        name: documentTitle(docType, load.loadNumber),
        documentNumber,
        generatedContent: plainTextForType(docType, load, documentNumber, company),
        generatedAt: new Date(),
        filePath: pdf.storedPath,
        mimeType: pdf.mimeType,
        originalFileName: pdf.originalFileName,
        fileSizeBytes: pdf.fileSizeBytes,
        notes: `Generated ${docType.toLowerCase().replace(/_/g, " ")} for email.`
      }
    });
  } else if (!document.filePath) {
    const documentNumber = document.documentNumber ?? (await nextDocumentNumber(user.companyId, docTypePrefix(docType)));
    const structured = structuredDocumentForType(docType, load, documentNumber, company);
    const pdf = await persistGeneratedPdf(user.companyId, structured);
    document = await prisma.loadDocument.update({
      where: { id: document.id },
      data: {
        generatedContent: plainTextForType(docType, load, documentNumber, company),
        generatedAt: new Date(),
        filePath: pdf.storedPath,
        mimeType: pdf.mimeType,
        originalFileName: pdf.originalFileName,
        fileSizeBytes: pdf.fileSizeBytes
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
  const content = await readFile(getAbsolutePath(document.filePath));
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

export async function prepareEmailDraft(loadId: string, purpose: EmailPurpose): Promise<EmailDraft> {
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
    if (!load.dispatchAssignment) {
      throw new Error(
        purpose === "POD_REQUEST"
          ? "Assign a carrier before requesting a POD."
          : "Assign a carrier before emailing a rate confirmation."
      );
    }
  }

  const to =
    purpose === "CARRIER_RATE_CONFIRMATION" || purpose === "POD_REQUEST"
      ? carrierEmail(load)
      : customerEmail(load);

  if (!to) {
    throw new Error(
      purpose === "CARRIER_RATE_CONFIRMATION" || purpose === "POD_REQUEST"
        ? "Carrier has no email address on file."
        : "Customer has no email address on file."
    );
  }

  const { document } = await ensurePrimaryDocument(purpose, load, user);
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
    supportingDocuments
  };
}

export async function sendPreparedEmail(formData: FormData) {
  const user = await requireWriteUser();
  const loadId = String(formData.get("loadId") ?? "").trim();
  const purpose = String(formData.get("purpose") ?? "").trim() as EmailPurpose;
  const to = String(formData.get("to") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!loadId || !purpose || !to || !subject || !body) {
    throw new Error("Email fields are required.");
  }

  const load = await loadForEmail(loadId, user);
  const { document, invoiceId } = await ensurePrimaryDocument(purpose, load, user);
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
  }

  revalidatePath(`/loads/${loadId}`);
  revalidatePath("/documents");
  revalidatePath("/accounting");

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
  const loadId = String(formData.get("loadId") ?? "").trim();
  const load = await loadForEmail(loadId, user);
  const documentNumber = await nextDocumentNumber(user.companyId, "CLC");
  const company = await getCompanyBranding(user.companyId);
  const structured = structuredDocumentForType(
    "CUSTOMER_LOAD_CONFIRMATION",
    load,
    documentNumber,
    company
  );
  const pdf = await persistGeneratedPdf(user.companyId, structured);

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
      generatedAt: new Date(),
      filePath: pdf.storedPath,
      mimeType: pdf.mimeType,
      originalFileName: pdf.originalFileName,
      fileSizeBytes: pdf.fileSizeBytes,
      notes: "Generated customer load confirmation."
    }
  });

  await prisma.loadActivity.create({
    data: {
      loadId,
      userId: user.id,
      action: "Customer load confirmation generated",
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
  const { syncMailboxThreadsForUser } = await import("@/lib/mail/user-mailbox");
  await syncMailboxThreadsForUser(user.id, user.companyId);
  revalidatePath(`/loads/${loadId}`);
}
