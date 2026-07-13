"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { canAccessRecord } from "@/lib/branch-filter-server";
import { requireWriteUser } from "@/lib/permissions";
import {
  buildCustomerInvoice,
  buildCustomerLoadConfirmation,
  buildPodRequestEmail,
  buildRateConfirmation,
  documentTitle,
  plainTextToHtml
} from "@/lib/document-templates";
import { sendViaUserMailbox } from "@/lib/mail/user-mailbox";

async function loadForEmail(loadId: string, user: SessionUser) {
  const load = await prisma.load.findUniqueOrThrow({
    where: { id: loadId, companyId: user.companyId },
    include: {
      customer: { include: { contacts: true } },
      stops: true,
      charges: true,
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

async function recordOutboundEmail(input: {
  user: SessionUser;
  loadId: string;
  purpose: string;
  subject: string;
  text: string;
  to: string;
  documentId?: string;
  invoiceId?: string;
}) {
  const sent = await sendViaUserMailbox({
    userId: input.user.id,
    to: [input.to],
    subject: input.subject,
    text: input.text,
    html: plainTextToHtml(input.text)
  });

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
          bodyText: input.text,
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
      details: `${input.purpose}: ${input.subject} → ${input.to}`
    }
  });

  return thread;
}

export async function emailRateConfirmation(formData: FormData) {
  const user = await requireWriteUser();
  const loadId = String(formData.get("loadId") ?? "").trim();
  const load = await loadForEmail(loadId, user);

  if (!load.dispatchAssignment) {
    throw new Error("Assign a carrier before emailing a rate confirmation.");
  }

  const to = carrierEmail(load);
  if (!to) {
    throw new Error("Carrier has no email address on file.");
  }

  let document = load.documents.find((item) => item.type === "RATE_CONFIRMATION");
  if (!document) {
    const documentNumber = await nextDocumentNumber(user.companyId, "RC");
    document = await prisma.loadDocument.create({
      data: {
        companyId: user.companyId,
        loadId: load.id,
        carrierId: load.dispatchAssignment.carrierId,
        type: "RATE_CONFIRMATION",
        name: documentTitle("RATE_CONFIRMATION", load.loadNumber),
        documentNumber,
        generatedContent: buildRateConfirmation(load, documentNumber),
        generatedAt: new Date(),
        notes: "Generated carrier rate confirmation for email."
      }
    });
  }

  const body = document.generatedContent ?? buildRateConfirmation(load, document.documentNumber ?? "RC");
  const subject = `Rate Confirmation ${load.loadNumber} - ${document.documentNumber ?? ""}`.trim();

  await recordOutboundEmail({
    user,
    loadId,
    purpose: "CARRIER_RATE_CONFIRMATION",
    subject,
    text: body,
    to,
    documentId: document.id
  });

  revalidatePath(`/loads/${loadId}`);
  revalidatePath("/documents");
  redirect(`/loads/${loadId}?emailed=rate-confirmation`);
}

export async function emailCustomerLoadConfirmation(formData: FormData) {
  const user = await requireWriteUser();
  const loadId = String(formData.get("loadId") ?? "").trim();
  const load = await loadForEmail(loadId, user);
  const to = customerEmail(load);
  if (!to) {
    throw new Error("Customer has no email address on file.");
  }

  let document = load.documents.find((item) => item.type === "CUSTOMER_LOAD_CONFIRMATION");
  if (!document) {
    const documentNumber = await nextDocumentNumber(user.companyId, "CLC");
    document = await prisma.loadDocument.create({
      data: {
        companyId: user.companyId,
        loadId: load.id,
        customerId: load.customerId,
        type: "CUSTOMER_LOAD_CONFIRMATION",
        name: documentTitle("CUSTOMER_LOAD_CONFIRMATION", load.loadNumber),
        documentNumber,
        generatedContent: buildCustomerLoadConfirmation(load, documentNumber),
        generatedAt: new Date(),
        notes: "Generated customer load confirmation for email."
      }
    });
  }

  const body =
    document.generatedContent ??
    buildCustomerLoadConfirmation(load, document.documentNumber ?? "CLC");
  const subject = `Load Confirmation ${load.loadNumber} - ${document.documentNumber ?? ""}`.trim();

  await recordOutboundEmail({
    user,
    loadId,
    purpose: "CUSTOMER_LOAD_CONFIRMATION",
    subject,
    text: body,
    to,
    documentId: document.id
  });

  revalidatePath(`/loads/${loadId}`);
  revalidatePath("/documents");
  redirect(`/loads/${loadId}?emailed=customer-load-confirmation`);
}

export async function emailInvoice(formData: FormData) {
  const user = await requireWriteUser();
  const loadId = String(formData.get("loadId") ?? "").trim();
  const load = await loadForEmail(loadId, user);
  const to = customerEmail(load);
  if (!to) {
    throw new Error("Customer has no email address on file.");
  }

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

  const refreshed = await loadForEmail(loadId, user);
  let document = refreshed.documents.find((item) => item.type === "INVOICE");
  if (!document) {
    document = await prisma.loadDocument.create({
      data: {
        companyId: user.companyId,
        loadId: load.id,
        customerId: load.customerId,
        type: "INVOICE",
        name: documentTitle("INVOICE", load.loadNumber),
        documentNumber: invoice.invoiceNo,
        generatedContent: buildCustomerInvoice(refreshed, invoice.invoiceNo),
        generatedAt: new Date(),
        notes: "Generated customer invoice for email."
      }
    });
  }

  const body = document.generatedContent ?? buildCustomerInvoice(refreshed, invoice.invoiceNo);
  const subject = `Invoice ${invoice.invoiceNo} for load ${load.loadNumber}`;

  await recordOutboundEmail({
    user,
    loadId,
    purpose: "INVOICE",
    subject,
    text: body,
    to,
    documentId: document.id,
    invoiceId: invoice.id
  });

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      status: "SENT",
      issuedAt: invoice.issuedAt ?? new Date()
    }
  });

  revalidatePath(`/loads/${loadId}`);
  revalidatePath("/accounting");
  revalidatePath("/documents");
  redirect(`/loads/${loadId}?emailed=invoice`);
}

export async function emailPodRequest(formData: FormData) {
  const user = await requireWriteUser();
  const loadId = String(formData.get("loadId") ?? "").trim();
  const load = await loadForEmail(loadId, user);

  if (!load.dispatchAssignment) {
    throw new Error("Assign a carrier before requesting a POD.");
  }

  const to = carrierEmail(load);
  if (!to) {
    throw new Error("Carrier has no email address on file.");
  }

  const mailbox = await prisma.userMailbox.findFirst({
    where: { userId: user.id, status: "CONNECTED" }
  });
  const brokerEmail = mailbox?.emailAddress || user.email;
  const body = buildPodRequestEmail(load, brokerEmail);
  const subject = `POD Request - Load ${load.loadNumber}`;

  await recordOutboundEmail({
    user,
    loadId,
    purpose: "POD_REQUEST",
    subject,
    text: body,
    to
  });

  revalidatePath(`/loads/${loadId}`);
  redirect(`/loads/${loadId}?emailed=pod-request`);
}

export async function generateCustomerLoadConfirmation(formData: FormData) {
  const user = await requireWriteUser();
  const loadId = String(formData.get("loadId") ?? "").trim();
  const load = await loadForEmail(loadId, user);
  const documentNumber = await nextDocumentNumber(user.companyId, "CLC");

  const document = await prisma.loadDocument.create({
    data: {
      companyId: user.companyId,
      loadId: load.id,
      customerId: load.customerId,
      type: "CUSTOMER_LOAD_CONFIRMATION",
      name: documentTitle("CUSTOMER_LOAD_CONFIRMATION", load.loadNumber),
      documentNumber,
      generatedContent: buildCustomerLoadConfirmation(load, documentNumber),
      generatedAt: new Date(),
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
