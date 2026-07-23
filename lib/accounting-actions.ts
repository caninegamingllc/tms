"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { assertPlanFeature, requireWriteUser } from "@/lib/permissions";
import { canAccessRecord } from "@/lib/branch-filter-server";
import { recalculateLoadCommission } from "@/lib/commission";
import { parseMoneyToCents } from "@/lib/format";
import { resolveCarrierApPayee } from "@/lib/accounting-payee";
import { dueDateFromTerms, statusFromBalance } from "@/lib/accounting-aging";
import {
  pushCarrierBillToQuickbooks,
  pushInvoiceToQuickbooks
} from "@/lib/quickbooks/online";
import { getCompanyQuickbooksMethod } from "@/lib/quickbooks/exports";
import { parseLocalDateTime } from "@/lib/dates";

function requiredString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) {
    throw new Error(`${key} is required`);
  }
  return value;
}

function optionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || undefined;
}

function optionalDate(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) {
    return undefined;
  }
  return parseLocalDateTime(value) ?? undefined;
}

function formIdList(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((value) => String(value).trim())
    .filter(Boolean);
}

/** Apply remaining balance as a payment (compat for mark-paid / QB reconcile). */
export async function applyFullInvoicePayment(input: {
  companyId: string;
  userId: string;
  invoiceId: string;
  method?: string;
  reference?: string;
  paidAt?: Date;
  notes?: string;
}) {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: input.invoiceId, companyId: input.companyId }
  });

  if (invoice.balanceCents <= 0 && invoice.status === "PAID") {
    return;
  }

  const amountCents = invoice.balanceCents > 0 ? invoice.balanceCents : invoice.totalCents;
  const paidAt = input.paidAt ?? new Date();

  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        companyId: input.companyId,
        direction: "AR",
        amountCents,
        paidAt,
        method: input.method ?? "OTHER",
        reference: input.reference,
        notes: input.notes ?? "Marked paid",
        customerId: invoice.customerId,
        createdByUserId: input.userId,
        applications: {
          create: {
            invoiceId: invoice.id,
            amountCents
          }
        }
      }
    });

    await tx.invoice.update({
      where: { id: invoice.id },
      data: { balanceCents: 0, status: "PAID", paidAt }
    });

    await tx.load.update({
      where: { id: invoice.loadId },
      data: {
        status: "PAID",
        activities: {
          create: {
            userId: input.userId,
            action: "Customer paid",
            details: `Invoice ${invoice.invoiceNo} marked paid (payment ${payment.id}).`
          }
        }
      }
    });
  });

  await recalculateLoadCommission(invoice.loadId);
}

export async function applyFullCarrierBillPayment(input: {
  companyId: string;
  userId: string;
  billId: string;
  method?: string;
  reference?: string;
  paidAt?: Date;
  notes?: string;
}) {
  const bill = await prisma.carrierBill.findUniqueOrThrow({
    where: { id: input.billId, companyId: input.companyId }
  });

  if (bill.balanceCents <= 0 && bill.status === "PAID") {
    return;
  }

  const amountCents = bill.balanceCents > 0 ? bill.balanceCents : bill.totalCents;
  const paidAt = input.paidAt ?? new Date();

  await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        companyId: input.companyId,
        direction: "AP",
        amountCents,
        paidAt,
        method: input.method ?? "OTHER",
        reference: input.reference,
        notes: input.notes ?? "Marked paid",
        carrierId: bill.carrierId,
        factoringCompanyId: bill.factoringCompanyId,
        createdByUserId: input.userId,
        applications: {
          create: {
            carrierBillId: bill.id,
            amountCents
          }
        }
      }
    });

    await tx.carrierBill.update({
      where: { id: bill.id },
      data: { balanceCents: 0, status: "PAID", paidAt }
    });
  });

  await prisma.loadActivity.create({
    data: {
      loadId: bill.loadId,
      userId: input.userId,
      action: "Carrier bill paid",
      details: `Carrier bill ${bill.billNo} marked paid.`
    }
  });
}

export async function createFactoringCompany(formData: FormData) {
  const admin = await requireAdmin();
  await assertPlanFeature(admin.companyId, "factoring_admin");
  const name = requiredString(formData, "name");
  const nameOnCheck = optionalString(formData, "nameOnCheck") ?? name;

  await prisma.factoringCompany.create({
    data: {
      companyId: admin.companyId,
      name,
      nameOnCheck,
      phone: optionalString(formData, "phone"),
      email: optionalString(formData, "email"),
      address: optionalString(formData, "address"),
      city: optionalString(formData, "city"),
      state: optionalString(formData, "state"),
      postalCode: optionalString(formData, "postalCode"),
      status: optionalString(formData, "status") ?? "Active"
    }
  });

  revalidatePath("/admin/accounting");
  revalidatePath("/carriers");
  redirect("/admin/accounting?factorSaved=1");
}

export async function updateFactoringCompany(formData: FormData) {
  const admin = await requireAdmin();
  await assertPlanFeature(admin.companyId, "factoring_admin");
  const id = requiredString(formData, "factoringCompanyId");
  const name = requiredString(formData, "name");
  const nameOnCheck = optionalString(formData, "nameOnCheck") ?? name;

  await prisma.factoringCompany.update({
    where: { id, companyId: admin.companyId },
    data: {
      name,
      nameOnCheck,
      phone: optionalString(formData, "phone"),
      email: optionalString(formData, "email"),
      address: optionalString(formData, "address"),
      city: optionalString(formData, "city"),
      state: optionalString(formData, "state"),
      postalCode: optionalString(formData, "postalCode"),
      status: optionalString(formData, "status") ?? "Active"
    }
  });

  revalidatePath("/admin/accounting");
  revalidatePath("/carriers");
  redirect("/admin/accounting?factorSaved=1");
}

export async function receiveArPayment(formData: FormData) {
  const user = await requireWriteUser();
  await assertPlanFeature(user.companyId, "accounting_ar_ap");
  const invoiceIds = formIdList(formData, "invoiceIds");
  if (invoiceIds.length === 0) {
    throw new Error("Select at least one invoice.");
  }

  const paidAt = optionalDate(formData, "paidAt") ?? new Date();
  const method = optionalString(formData, "method") ?? "CHECK";
  const reference = optionalString(formData, "reference");
  const notes = optionalString(formData, "notes");

  const invoices = await prisma.invoice.findMany({
    where: {
      id: { in: invoiceIds },
      companyId: user.companyId,
      status: { not: "VOID" }
    },
    include: { load: true },
    orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }]
  });

  for (const invoice of invoices) {
    if (!(await canAccessRecord(user, invoice.load.branchId))) {
      throw new Error("Invoice not found.");
    }
  }

  const open = invoices.filter((invoice) => invoice.balanceCents > 0);
  if (open.length === 0) {
    throw new Error("Selected invoices have no open balance.");
  }

  const customerId = open[0].customerId;
  if (open.some((invoice) => invoice.customerId !== customerId)) {
    throw new Error("Receive payment for one customer at a time.");
  }

  const requestedAmount = formData.get("amount");
  const totalOpen = open.reduce((sum, invoice) => sum + invoice.balanceCents, 0);
  let remaining =
    requestedAmount != null && String(requestedAmount).trim() !== ""
      ? parseMoneyToCents(requestedAmount)
      : totalOpen;

  if (remaining <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }

  const applications: { invoiceId: string; amountCents: number }[] = [];
  for (const invoice of open) {
    if (remaining <= 0) {
      break;
    }
    const applyCents = Math.min(remaining, invoice.balanceCents);
    if (applyCents > 0) {
      applications.push({ invoiceId: invoice.id, amountCents: applyCents });
      remaining -= applyCents;
    }
  }

  const paymentAmount = applications.reduce((sum, row) => sum + row.amountCents, 0);
  const paymentPaidAt = paidAt;

  await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        companyId: user.companyId,
        direction: "AR",
        amountCents: paymentAmount,
        paidAt: paymentPaidAt,
        method,
        reference,
        notes,
        customerId,
        createdByUserId: user.id,
        applications: {
          create: applications.map((row) => ({
            invoiceId: row.invoiceId,
            amountCents: row.amountCents
          }))
        }
      }
    });

    for (const row of applications) {
      const invoice = open.find((item) => item.id === row.invoiceId)!;
      const balanceCents = invoice.balanceCents - row.amountCents;
      const status = statusFromBalance({
        balanceCents,
        totalCents: invoice.totalCents,
        dueAt: invoice.dueAt,
        currentStatus: invoice.status
      });

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          balanceCents,
          status,
          paidAt: balanceCents <= 0 ? paymentPaidAt : invoice.paidAt
        }
      });

      if (balanceCents <= 0) {
        await tx.load.update({
          where: { id: invoice.loadId },
          data: {
            status: "PAID",
            activities: {
              create: {
                userId: user.id,
                action: "Customer paid",
                details: `Invoice ${invoice.invoiceNo} paid in full.`
              }
            }
          }
        });
      }
    }
  });

  for (const row of applications) {
    const invoice = open.find((item) => item.id === row.invoiceId)!;
    if (invoice.balanceCents - row.amountCents <= 0) {
      await recalculateLoadCommission(invoice.loadId);
    }
  }

  revalidatePath("/accounting");
  revalidatePath("/commissions");
  revalidatePath("/loads");
  redirect("/accounting?tab=invoices&paymentReceived=1");
}

export async function recordApPayment(formData: FormData) {
  const user = await requireWriteUser();
  await assertPlanFeature(user.companyId, "accounting_ar_ap");
  const billIds = formIdList(formData, "billIds");
  if (billIds.length === 0) {
    throw new Error("Select at least one bill.");
  }

  const paidAt = optionalDate(formData, "paidAt") ?? new Date();
  const method = optionalString(formData, "method") ?? "CHECK";
  const reference = optionalString(formData, "reference");
  const notes = optionalString(formData, "notes");

  const bills = await prisma.carrierBill.findMany({
    where: {
      id: { in: billIds },
      companyId: user.companyId,
      status: { not: "VOID" }
    },
    include: { load: true },
    orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }]
  });

  for (const bill of bills) {
    if (!(await canAccessRecord(user, bill.load.branchId))) {
      throw new Error("Carrier bill not found.");
    }
  }

  const open = bills.filter((bill) => bill.balanceCents > 0);
  if (open.length === 0) {
    throw new Error("Selected bills have no open balance.");
  }

  const carrierId = open[0].carrierId;
  if (open.some((bill) => bill.carrierId !== carrierId)) {
    throw new Error("Record payment for one carrier (payee group) at a time.");
  }

  const requestedAmount = formData.get("amount");
  const totalOpen = open.reduce((sum, bill) => sum + bill.balanceCents, 0);
  let remaining =
    requestedAmount != null && String(requestedAmount).trim() !== ""
      ? parseMoneyToCents(requestedAmount)
      : totalOpen;

  if (remaining <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }

  const applications: { carrierBillId: string; amountCents: number }[] = [];
  for (const bill of open) {
    if (remaining <= 0) {
      break;
    }
    const applyCents = Math.min(remaining, bill.balanceCents);
    if (applyCents > 0) {
      applications.push({ carrierBillId: bill.id, amountCents: applyCents });
      remaining -= applyCents;
    }
  }

  const paymentAmount = applications.reduce((sum, row) => sum + row.amountCents, 0);
  const factoringCompanyId = open[0].factoringCompanyId;

  await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        companyId: user.companyId,
        direction: "AP",
        amountCents: paymentAmount,
        paidAt,
        method,
        reference,
        notes,
        carrierId,
        factoringCompanyId,
        createdByUserId: user.id,
        applications: {
          create: applications.map((row) => ({
            carrierBillId: row.carrierBillId,
            amountCents: row.amountCents
          }))
        }
      }
    });

    for (const row of applications) {
      const bill = open.find((item) => item.id === row.carrierBillId)!;
      const balanceCents = bill.balanceCents - row.amountCents;
      const status = statusFromBalance({
        balanceCents,
        totalCents: bill.totalCents,
        dueAt: bill.dueAt,
        currentStatus: bill.status
      });

      await tx.carrierBill.update({
        where: { id: bill.id },
        data: {
          balanceCents,
          status,
          paidAt: balanceCents <= 0 ? paidAt : bill.paidAt
        }
      });

      await tx.loadActivity.create({
        data: {
          loadId: bill.loadId,
          userId: user.id,
          action: balanceCents <= 0 ? "Carrier bill paid" : "Carrier bill partial payment",
          details: `Carrier bill ${bill.billNo}: applied payment.`
        }
      });
    }
  });

  revalidatePath("/accounting");
  revalidatePath("/loads");
  redirect("/accounting?tab=bills&paymentRecorded=1");
}

export async function bulkEmailInvoicesAction(formData: FormData) {
  const user = await requireWriteUser();
  await assertPlanFeature(user.companyId, "bulk_invoice_email");
  const invoiceIds = formIdList(formData, "invoiceIds");
  if (invoiceIds.length === 0) {
    redirect("/accounting?tab=invoices&error=" + encodeURIComponent("Select at least one invoice."));
  }

  const { prepareEmailDraft, sendPreparedEmail } = await import("@/lib/email-ops-actions");

  const invoices = await prisma.invoice.findMany({
    where: { id: { in: invoiceIds }, companyId: user.companyId },
    include: { load: true }
  });

  let emailed = 0;
  for (const invoice of invoices) {
    if (!(await canAccessRecord(user, invoice.load.branchId))) {
      continue;
    }
    try {
      const draft = await prepareEmailDraft(invoice.loadId, "INVOICE");
      const sendData = new FormData();
      sendData.set("loadId", draft.loadId);
      sendData.set("purpose", draft.purpose);
      sendData.set("to", draft.to);
      sendData.set("subject", draft.subject);
      sendData.set("body", draft.body);
      sendData.set("skipRedirect", "1");
      for (const supporting of draft.supportingDocuments) {
        sendData.append("supportingDocumentIds", supporting.id);
      }
      await sendPreparedEmail(sendData);
      emailed += 1;
    } catch {
      // skip failures
    }
  }

  redirect(`/accounting?tab=invoices&emailed=${emailed}`);
}

export async function bulkPushInvoicesToQuickbooks(formData: FormData) {
  const user = await requireWriteUser();
  await assertPlanFeature(user.companyId, "bulk_invoice_email");
  const invoiceIds = formIdList(formData, "invoiceIds");
  const method = await getCompanyQuickbooksMethod(user.companyId);
  if (method !== "ONLINE") {
    redirect("/accounting?tab=invoices&error=" + encodeURIComponent("QuickBooks Online is not the active method."));
  }

  let pushed = 0;
  for (const invoiceId of invoiceIds) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId, companyId: user.companyId },
      include: { load: true }
    });
    if (!invoice || !(await canAccessRecord(user, invoice.load.branchId))) {
      continue;
    }
    try {
      await pushInvoiceToQuickbooks({
        companyId: user.companyId,
        invoiceId,
        userId: user.id
      });
      pushed += 1;
    } catch {
      // continue
    }
  }

  revalidatePath("/accounting");
  redirect(`/accounting?tab=invoices&qbPushed=${pushed}`);
}

export async function bulkPushBillsToQuickbooks(formData: FormData) {
  const user = await requireWriteUser();
  await assertPlanFeature(user.companyId, "bulk_invoice_email");
  const billIds = formIdList(formData, "billIds");
  const method = await getCompanyQuickbooksMethod(user.companyId);
  if (method !== "ONLINE") {
    redirect("/accounting?tab=bills&error=" + encodeURIComponent("QuickBooks Online is not the active method."));
  }

  let pushed = 0;
  for (const billId of billIds) {
    const bill = await prisma.carrierBill.findUnique({
      where: { id: billId, companyId: user.companyId },
      include: { load: true }
    });
    if (!bill || !(await canAccessRecord(user, bill.load.branchId))) {
      continue;
    }
    try {
      await pushCarrierBillToQuickbooks({
        companyId: user.companyId,
        billId,
        userId: user.id
      });
      pushed += 1;
    } catch {
      // continue
    }
  }

  revalidatePath("/accounting");
  redirect(`/accounting?tab=bills&qbPushed=${pushed}`);
}

export async function recomputeOverdueStatuses(companyId: string) {
  const now = new Date();

  // Bulk mark past-due open balances as OVERDUE (covers the common browse-path case).
  // Leave PARTIAL alone — partial payment status takes precedence over overdue.
  await Promise.all([
    prisma.invoice.updateMany({
      where: {
        companyId,
        balanceCents: { gt: 0 },
        dueAt: { lt: now },
        status: { in: ["DRAFT", "SENT", "APPROVED"] }
      },
      data: { status: "OVERDUE" }
    }),
    prisma.carrierBill.updateMany({
      where: {
        companyId,
        balanceCents: { gt: 0 },
        dueAt: { lt: now },
        status: { in: ["DRAFT", "SENT", "APPROVED"] }
      },
      data: { status: "OVERDUE" }
    })
  ]);

  // Clear OVERDUE back to SENT when due date is still in the future (e.g. terms edited).
  await Promise.all([
    prisma.invoice.updateMany({
      where: {
        companyId,
        balanceCents: { gt: 0 },
        status: "OVERDUE",
        OR: [{ dueAt: null }, { dueAt: { gte: now } }]
      },
      data: { status: "SENT" }
    }),
    prisma.carrierBill.updateMany({
      where: {
        companyId,
        balanceCents: { gt: 0 },
        status: "OVERDUE",
        OR: [{ dueAt: null }, { dueAt: { gte: now } }]
      },
      data: { status: "SENT" }
    })
  ]);
}

export { resolveCarrierApPayee, dueDateFromTerms };
