import { NextResponse } from "next/server";
import { requireWriteUser } from "@/lib/permissions";
import { canAccessRecord } from "@/lib/branch-filter-server";
import { prisma } from "@/lib/db";
import { getCompanyQuickbooksMethod, upsertAccountingExport } from "@/lib/quickbooks/exports";
import { buildIifFile } from "@/lib/quickbooks/iif";

export async function GET(request: Request) {
  const user = await requireWriteUser();
  const method = await getCompanyQuickbooksMethod(user.companyId);

  if (method !== "IIF") {
    return NextResponse.redirect(
      new URL("/accounting?error=IIF%20export%20is%20not%20the%20active%20method", request.url)
    );
  }

  const url = new URL(request.url);
  const includeExported = url.searchParams.get("includeExported") === "1";
  const invoiceIdsParam = url.searchParams.get("invoiceIds");
  const billIdsParam = url.searchParams.get("billIds");

  const company = await prisma.company.findUniqueOrThrow({
    where: { id: user.companyId },
    select: { quickbooksConfigJson: true, name: true }
  });

  const invoiceWhere = {
    companyId: user.companyId,
    ...(invoiceIdsParam
      ? { id: { in: invoiceIdsParam.split(",").filter(Boolean) } }
      : { status: { notIn: ["VOID"] } })
  };

  const billWhere = {
    companyId: user.companyId,
    ...(billIdsParam
      ? { id: { in: billIdsParam.split(",").filter(Boolean) } }
      : { status: { notIn: ["VOID"] } })
  };

  const [invoices, bills, existingInvoiceExports, existingBillExports] = await Promise.all([
    prisma.invoice.findMany({
      where: invoiceWhere,
      include: { customer: true, load: true }
    }),
    prisma.carrierBill.findMany({
      where: billWhere,
      include: { carrier: true, load: true, factoringCompany: true }
    }),
    prisma.accountingExport.findMany({
      where: {
        companyId: user.companyId,
        method: "IIF",
        entityType: "INVOICE",
        status: "SYNCED"
      }
    }),
    prisma.accountingExport.findMany({
      where: {
        companyId: user.companyId,
        method: "IIF",
        entityType: "CARRIER_BILL",
        status: "SYNCED"
      }
    })
  ]);

  const exportedInvoiceIds = new Set(existingInvoiceExports.map((row) => row.entityId));
  const exportedBillIds = new Set(existingBillExports.map((row) => row.entityId));

  const accessibleInvoices = [];
  for (const invoice of invoices) {
    if (!(await canAccessRecord(user, invoice.load.branchId))) continue;
    if (!includeExported && exportedInvoiceIds.has(invoice.id) && !invoiceIdsParam) continue;
    accessibleInvoices.push(invoice);
  }

  const accessibleBills = [];
  for (const bill of bills) {
    if (!(await canAccessRecord(user, bill.load.branchId))) continue;
    if (!includeExported && exportedBillIds.has(bill.id) && !billIdsParam) continue;
    accessibleBills.push(bill);
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
  const filename = `tms-quickbooks-${stamp}.iif`;

  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
