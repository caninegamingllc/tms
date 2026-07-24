import { NextResponse } from "next/server";
import { requireWriteUser } from "@/lib/permissions";
import { canAccessRecord } from "@/lib/branch-filter-server";
import { prisma } from "@/lib/db";
import { getCompanyQuickbooksMethod, upsertAccountingExport } from "@/lib/quickbooks/exports";
import { buildIifFile } from "@/lib/quickbooks/iif";

function parseIds(param: string | null): string[] {
  if (!param) return [];
  return param.split(",").map((id) => id.trim()).filter(Boolean);
}

function redirectError(request: Request, message: string) {
  return NextResponse.redirect(new URL(`/accounting?error=${encodeURIComponent(message)}`, request.url));
}

export async function GET(request: Request) {
  const user = await requireWriteUser();
  const method = await getCompanyQuickbooksMethod(user.companyId);

  if (method !== "IIF") {
    return redirectError(request, "IIF export is not the active method");
  }

  const url = new URL(request.url);
  const invoiceIds = parseIds(url.searchParams.get("invoiceIds"));
  const billIds = parseIds(url.searchParams.get("billIds"));

  if (invoiceIds.length === 0 && billIds.length === 0) {
    return redirectError(request, "Select invoices or bills to send to accounting");
  }

  if (invoiceIds.length > 0 && billIds.length > 0) {
    return redirectError(request, "Export invoices or bills separately, not both in one IIF file");
  }

  const company = await prisma.company.findUniqueOrThrow({
    where: { id: user.companyId },
    select: { quickbooksConfigJson: true, name: true }
  });

  const exportInvoices = invoiceIds.length > 0;
  const invoices = exportInvoices
    ? await prisma.invoice.findMany({
        where: { companyId: user.companyId, id: { in: invoiceIds } },
        include: { customer: true, load: true }
      })
    : [];
  const bills = !exportInvoices
    ? await prisma.carrierBill.findMany({
        where: { companyId: user.companyId, id: { in: billIds } },
        include: { carrier: true, load: true, factoringCompany: true }
      })
    : [];

  const accessibleInvoices = [];
  for (const invoice of invoices) {
    if (!(await canAccessRecord(user, invoice.load.branchId))) continue;
    accessibleInvoices.push(invoice);
  }

  const accessibleBills = [];
  for (const bill of bills) {
    if (!(await canAccessRecord(user, bill.load.branchId))) continue;
    accessibleBills.push(bill);
  }

  if (accessibleInvoices.length === 0 && accessibleBills.length === 0) {
    return redirectError(request, "No accessible invoices or bills found for export");
  }

  const customerMap = new Map(
    accessibleInvoices.map((invoice) => [invoice.customer.id, invoice.customer])
  );

  const vendorMap = new Map<
    string,
    {
      name: string;
      printAs?: string | null;
      address?: string | null;
      city?: string | null;
      state?: string | null;
      postalCode?: string | null;
      phone?: string | null;
      email?: string | null;
    }
  >();

  for (const bill of accessibleBills) {
    const factor = bill.factoringCompany;
    const displayName = bill.payeeName || factor?.name || bill.carrier.name;
    const printAs = bill.nameOnCheck || factor?.nameOnCheck || displayName;
    if (!vendorMap.has(displayName)) {
      vendorMap.set(displayName, {
        name: displayName,
        printAs,
        address: factor?.address ?? bill.carrier.address,
        city: factor?.city ?? bill.carrier.city,
        state: factor?.state ?? bill.carrier.state,
        postalCode: factor?.postalCode ?? bill.carrier.postalCode,
        phone: factor?.phone ?? bill.carrier.phone,
        email: factor?.email ?? bill.carrier.email
      });
    }
  }

  const content = buildIifFile({
    customers: [...customerMap.values()],
    vendors: [...vendorMap.values()],
    invoices: accessibleInvoices.map((invoice) => ({
      docNumber: invoice.invoiceNo,
      date: invoice.issuedAt ?? invoice.createdAt,
      customerName: invoice.customer.name,
      amountCents: invoice.totalCents,
      memo: `Load ${invoice.load.loadNumber}`
    })),
    bills: accessibleBills.map((bill) => ({
      docNumber: bill.billNo,
      date: bill.receivedAt ?? bill.createdAt,
      vendorName: bill.payeeName || bill.factoringCompany?.name || bill.carrier.name,
      amountCents: bill.totalCents,
      memo: `Load ${bill.load.loadNumber}`
    })),
    configJson: company.quickbooksConfigJson
  });

  for (const invoice of accessibleInvoices) {
    await upsertAccountingExport({
      companyId: user.companyId,
      entityType: "INVOICE",
      entityId: invoice.id,
      method: "IIF",
      status: "SYNCED",
      exportedByUserId: user.id
    });
  }

  for (const bill of accessibleBills) {
    await upsertAccountingExport({
      companyId: user.companyId,
      entityType: "CARRIER_BILL",
      entityId: bill.id,
      method: "IIF",
      status: "SYNCED",
      exportedByUserId: user.id
    });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const kind = exportInvoices ? "invoices" : "bills";
  const filename = `tms-quickbooks-${kind}-${stamp}.iif`;

  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
