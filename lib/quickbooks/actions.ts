"use server";

import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertPlanFeature, requireWriteUser } from "@/lib/permissions";
import { canAccessRecord } from "@/lib/branch-filter-server";
import {
  disconnectQuickbooksOnline,
  pushCarrierBillToQuickbooks,
  pushInvoiceToQuickbooks,
  reconcileQuickbooksPayments
} from "@/lib/quickbooks/online";
import {
  OAUTH_STATE_COOKIE,
  defaultQuickbooksConfig,
  type QuickbooksMethod
} from "@/lib/quickbooks/types";

export async function updateAccountingSettings(formData: FormData) {
  const actor = await requireAdmin();
  const methodRaw = String(formData.get("quickbooksMethod") ?? "NONE").trim();
  const method: QuickbooksMethod =
    methodRaw === "ONLINE" || methodRaw === "IIF" || methodRaw === "NONE" ? methodRaw : "NONE";

  if (method === "IIF") {
    await assertPlanFeature(actor.companyId, "quickbooks_iif");
  }
  if (method === "ONLINE") {
    await assertPlanFeature(actor.companyId, "quickbooks_online");
  }

  const config = {
    accountsReceivable:
      String(formData.get("accountsReceivable") ?? "").trim() ||
      defaultQuickbooksConfig.accountsReceivable,
    accountsPayable:
      String(formData.get("accountsPayable") ?? "").trim() || defaultQuickbooksConfig.accountsPayable,
    freightIncome:
      String(formData.get("freightIncome") ?? "").trim() || defaultQuickbooksConfig.freightIncome,
    purchasedTransportation:
      String(formData.get("purchasedTransportation") ?? "").trim() ||
      defaultQuickbooksConfig.purchasedTransportation,
    incomeItem: String(formData.get("incomeItem") ?? "").trim() || defaultQuickbooksConfig.incomeItem,
    expenseItem:
      String(formData.get("expenseItem") ?? "").trim() || defaultQuickbooksConfig.expenseItem
  };

  await prisma.company.update({
    where: { id: actor.companyId },
    data: {
      quickbooksMethod: method,
      quickbooksConfigJson: JSON.stringify(config)
    }
  });

  await prisma.auditLog.create({
    data: {
      companyId: actor.companyId,
      actorUserId: actor.id,
      action: "Updated accounting settings",
      entityType: "Company",
      entityId: actor.companyId,
      details: `QuickBooks method set to ${method}.`
    }
  });

  revalidatePath("/admin/accounting");
  revalidatePath("/accounting");
  revalidatePath("/integrations");
  redirect("/admin/accounting?saved=1");
}

export async function startQuickbooksConnect() {
  const actor = await requireAdmin();
  await assertPlanFeature(actor.companyId, "quickbooks_online");
  const state = `${actor.companyId}:${randomBytes(16).toString("hex")}`;
  const cookieStore = await cookies();
  cookieStore.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10
  });
  redirect(`/api/integrations/quickbooks/connect?state=${encodeURIComponent(state)}`);
}

export async function disconnectQuickbooksAction() {
  const actor = await requireAdmin();
  await disconnectQuickbooksOnline(actor.companyId);
  revalidatePath("/admin/accounting");
  revalidatePath("/integrations");
  redirect("/admin/accounting?disconnected=1");
}

export async function pushInvoiceToQuickbooksAction(formData: FormData) {
  const user = await requireWriteUser();
  const invoiceId = String(formData.get("invoiceId") ?? "").trim();
  if (!invoiceId) {
    throw new Error("invoiceId is required");
  }

  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId, companyId: user.companyId },
    include: { load: true }
  });
  if (!(await canAccessRecord(user, invoice.load.branchId))) {
    throw new Error("Invoice not found.");
  }

  await pushInvoiceToQuickbooks({
    companyId: user.companyId,
    invoiceId,
    userId: user.id
  });

  revalidatePath("/accounting");
  revalidatePath(`/loads/${invoice.loadId}`);
  revalidatePath("/integrations");
}

export async function pushCarrierBillToQuickbooksAction(formData: FormData) {
  const user = await requireWriteUser();
  const billId = String(formData.get("billId") ?? "").trim();
  if (!billId) {
    throw new Error("billId is required");
  }

  const bill = await prisma.carrierBill.findUniqueOrThrow({
    where: { id: billId, companyId: user.companyId },
    include: { load: true }
  });
  if (!(await canAccessRecord(user, bill.load.branchId))) {
    throw new Error("Carrier bill not found.");
  }

  await pushCarrierBillToQuickbooks({
    companyId: user.companyId,
    billId,
    userId: user.id
  });

  revalidatePath("/accounting");
  revalidatePath(`/loads/${bill.loadId}`);
  revalidatePath("/integrations");
}

export async function markCarrierBillPaid(formData: FormData) {
  const user = await requireWriteUser();
  const billId = String(formData.get("billId") ?? "").trim();
  if (!billId) {
    throw new Error("billId is required");
  }

  const bill = await prisma.carrierBill.findUniqueOrThrow({
    where: { id: billId, companyId: user.companyId },
    include: { load: true }
  });
  if (!(await canAccessRecord(user, bill.load.branchId))) {
    throw new Error("Carrier bill not found.");
  }

  const { applyFullCarrierBillPayment } = await import("@/lib/accounting-actions");
  await applyFullCarrierBillPayment({
    companyId: user.companyId,
    userId: user.id,
    billId
  });

  revalidatePath("/accounting");
  revalidatePath(`/loads/${bill.loadId}`);
}

async function markInvoicePaidInternal(companyId: string, invoiceId: string, userId: string) {
  const { applyFullInvoicePayment } = await import("@/lib/accounting-actions");
  await applyFullInvoicePayment({
    companyId,
    userId,
    invoiceId,
    notes: "Marked paid from QuickBooks reconcile"
  });
}

async function markCarrierBillPaidInternal(companyId: string, billId: string, userId: string) {
  const { applyFullCarrierBillPayment } = await import("@/lib/accounting-actions");
  await applyFullCarrierBillPayment({
    companyId,
    userId,
    billId,
    notes: "Marked paid from QuickBooks reconcile"
  });
}

export async function reconcileQuickbooksPaymentsAction() {
  const user = await requireWriteUser();
  const result = await reconcileQuickbooksPayments({
    companyId: user.companyId,
    markInvoicePaid: (invoiceId) => markInvoicePaidInternal(user.companyId, invoiceId, user.id),
    markCarrierBillPaid: (billId) => markCarrierBillPaidInternal(user.companyId, billId, user.id)
  });

  revalidatePath("/accounting");
  revalidatePath("/commissions");
  revalidatePath("/loads");
  revalidatePath("/integrations");
  redirect(
    `/accounting?reconciled=1&invoices=${result.invoicesMarked}&bills=${result.billsMarked}`
  );
}
