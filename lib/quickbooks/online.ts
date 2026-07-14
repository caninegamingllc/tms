import { resolveOAuthRedirectUri } from "@/lib/app-url";
import { prisma } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/quickbooks/crypto";
import { parseQuickbooksConfig } from "@/lib/quickbooks/types";
import { upsertAccountingExport } from "@/lib/quickbooks/exports";

const QUICKBOOKS_PROVIDER = "QUICKBOOKS";

function intuitEnv() {
  const environment = process.env.INTUIT_ENVIRONMENT === "production" ? "production" : "sandbox";
  const clientId = process.env.INTUIT_CLIENT_ID ?? "";
  const clientSecret = process.env.INTUIT_CLIENT_SECRET ?? "";
  const redirectUri = resolveOAuthRedirectUri(
    process.env.INTUIT_REDIRECT_URI,
    "/api/integrations/quickbooks/callback"
  );

  return { environment, clientId, clientSecret, redirectUri };
}

export function isQuickbooksOnlineConfigured() {
  const { clientId, clientSecret } = intuitEnv();
  return Boolean(clientId && clientSecret);
}

export function getQuickbooksAuthorizeUrl(state: string) {
  const { clientId, redirectUri } = intuitEnv();
  if (!clientId) {
    throw new Error("INTUIT_CLIENT_ID is not configured.");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    scope: "com.intuit.quickbooks.accounting",
    redirect_uri: redirectUri,
    state
  });

  return `https://appcenter.intuit.com/connect/oauth2?${params.toString()}`;
}

async function exchangeToken(body: URLSearchParams) {
  const { clientId, clientSecret } = intuitEnv();
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json"
    },
    body
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`QuickBooks token exchange failed: ${text}`);
  }

  return (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    x_refresh_token_expires_in?: number;
  };
}

export async function storeQuickbooksTokens(input: {
  companyId: string;
  realmId: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}) {
  const tokenExpiresAt = new Date(Date.now() + input.expiresIn * 1000);
  const accessTokenEnc = encryptSecret(input.accessToken);
  const refreshTokenEnc = encryptSecret(input.refreshToken);

  await prisma.integrationAccount.upsert({
    where: {
      companyId_provider: {
        companyId: input.companyId,
        provider: QUICKBOOKS_PROVIDER
      }
    },
    create: {
      companyId: input.companyId,
      provider: QUICKBOOKS_PROVIDER,
      displayName: "QuickBooks Online",
      status: "Connected",
      notes: "Sync invoices and carrier bills via QuickBooks Online API.",
      realmId: input.realmId,
      accessTokenEnc,
      refreshTokenEnc,
      tokenExpiresAt,
      connectedAt: new Date(),
      lastError: null
    },
    update: {
      status: "Connected",
      realmId: input.realmId,
      accessTokenEnc,
      refreshTokenEnc,
      tokenExpiresAt,
      connectedAt: new Date(),
      lastError: null
    }
  });
}

export async function exchangeAuthorizationCode(input: {
  companyId: string;
  code: string;
  realmId: string;
}) {
  const { redirectUri } = intuitEnv();
  const tokens = await exchangeToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: redirectUri
    })
  );

  await storeQuickbooksTokens({
    companyId: input.companyId,
    realmId: input.realmId,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresIn: tokens.expires_in
  });
}

export async function disconnectQuickbooksOnline(companyId: string) {
  await prisma.integrationAccount.updateMany({
    where: { companyId, provider: QUICKBOOKS_PROVIDER },
    data: {
      status: "Not Connected",
      realmId: null,
      accessTokenEnc: null,
      refreshTokenEnc: null,
      tokenExpiresAt: null,
      connectedAt: null,
      lastError: null
    }
  });
}

async function getConnectedAccount(companyId: string) {
  const account = await prisma.integrationAccount.findUnique({
    where: {
      companyId_provider: { companyId, provider: QUICKBOOKS_PROVIDER }
    }
  });

  if (!account || account.status !== "Connected" || !account.realmId || !account.refreshTokenEnc) {
    throw new Error("QuickBooks Online is not connected.");
  }

  return account;
}

async function getAccessToken(companyId: string) {
  const account = await getConnectedAccount(companyId);
  const expiresAt = account.tokenExpiresAt?.getTime() ?? 0;
  const stillValid = expiresAt > Date.now() + 60_000 && account.accessTokenEnc;

  if (stillValid && account.accessTokenEnc) {
    return {
      accessToken: decryptSecret(account.accessTokenEnc),
      realmId: account.realmId!
    };
  }

  const refreshToken = decryptSecret(account.refreshTokenEnc!);
  const tokens = await exchangeToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken
    })
  );

  await storeQuickbooksTokens({
    companyId,
    realmId: account.realmId!,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresIn: tokens.expires_in
  });

  return {
    accessToken: tokens.access_token,
    realmId: account.realmId!
  };
}

function apiBase(realmId: string) {
  const host =
    intuitEnv().environment === "production"
      ? "https://quickbooks.api.intuit.com"
      : "https://sandbox-quickbooks.api.intuit.com";
  return `${host}/v3/company/${realmId}`;
}

async function qboRequest<T>(
  companyId: string,
  path: string,
  init?: RequestInit & { query?: Record<string, string> }
): Promise<T> {
  const { accessToken, realmId } = await getAccessToken(companyId);
  const url = new URL(`${apiBase(realmId)}${path}`);
  if (init?.query) {
    for (const [key, value] of Object.entries(init.query)) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const text = await response.text();
    await prisma.integrationAccount.updateMany({
      where: { companyId, provider: QUICKBOOKS_PROVIDER },
      data: { lastError: text.slice(0, 1000) }
    });
    throw new Error(`QuickBooks API error: ${text.slice(0, 500)}`);
  }

  await prisma.integrationAccount.updateMany({
    where: { companyId, provider: QUICKBOOKS_PROVIDER },
    data: { lastSyncAt: new Date(), lastError: null }
  });

  return (await response.json()) as T;
}

function escapeQboQuery(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function findEntityByDisplayName(
  companyId: string,
  entity: "Customer" | "Vendor",
  displayName: string
) {
  const query = `select * from ${entity} where DisplayName = '${escapeQboQuery(displayName)}'`;
  const result = await qboRequest<{ QueryResponse?: Record<string, Array<{ Id: string }>> }>(
    companyId,
    "/query",
    { query: { query, minorversion: "65" } }
  );
  const rows = result.QueryResponse?.[entity] ?? [];
  return rows[0]?.Id ?? null;
}

async function ensureCustomer(companyId: string, customerId: string) {
  const customer = await prisma.customer.findUniqueOrThrow({
    where: { id: customerId, companyId }
  });

  if (customer.externalQboId) {
    return customer.externalQboId;
  }

  const existingId = await findEntityByDisplayName(companyId, "Customer", customer.name);
  if (existingId) {
    await prisma.customer.update({
      where: { id: customer.id },
      data: { externalQboId: existingId }
    });
    return existingId;
  }

  const created = await qboRequest<{ Customer: { Id: string } }>(companyId, "/customer", {
    method: "POST",
    query: { minorversion: "65" },
    body: JSON.stringify({
      DisplayName: customer.name,
      PrimaryEmailAddr: customer.email ? { Address: customer.email } : undefined,
      PrimaryPhone: customer.phone ? { FreeFormNumber: customer.phone } : undefined,
      BillAddr: {
        Line1: customer.address ?? undefined,
        City: customer.city ?? undefined,
        CountrySubDivisionCode: customer.state ?? undefined,
        PostalCode: customer.postalCode ?? undefined
      }
    })
  });

  await prisma.customer.update({
    where: { id: customer.id },
    data: { externalQboId: created.Customer.Id }
  });

  return created.Customer.Id;
}

async function ensureVendor(companyId: string, carrierId: string) {
  const carrier = await prisma.carrier.findUniqueOrThrow({
    where: { id: carrierId, companyId }
  });

  if (carrier.externalQboId) {
    return carrier.externalQboId;
  }

  const existingId = await findEntityByDisplayName(companyId, "Vendor", carrier.name);
  if (existingId) {
    await prisma.carrier.update({
      where: { id: carrier.id },
      data: { externalQboId: existingId }
    });
    return existingId;
  }

  const created = await qboRequest<{ Vendor: { Id: string } }>(companyId, "/vendor", {
    method: "POST",
    query: { minorversion: "65" },
    body: JSON.stringify({
      DisplayName: carrier.name,
      PrimaryEmailAddr: carrier.email ? { Address: carrier.email } : undefined,
      PrimaryPhone: carrier.phone ? { FreeFormNumber: carrier.phone } : undefined,
      BillAddr: {
        Line1: carrier.address ?? undefined,
        City: carrier.city ?? undefined,
        CountrySubDivisionCode: carrier.state ?? undefined,
        PostalCode: carrier.postalCode ?? undefined
      }
    })
  });

  await prisma.carrier.update({
    where: { id: carrier.id },
    data: { externalQboId: created.Vendor.Id }
  });

  return created.Vendor.Id;
}

function centsToAmount(cents: number) {
  return Number((cents / 100).toFixed(2));
}

function formatQboDate(date: Date | null | undefined) {
  const d = date ?? new Date();
  return d.toISOString().slice(0, 10);
}

export async function pushInvoiceToQuickbooks(input: {
  companyId: string;
  invoiceId: string;
  userId?: string;
}) {
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: input.companyId },
    select: { quickbooksMethod: true, quickbooksConfigJson: true }
  });

  if (company.quickbooksMethod !== "ONLINE") {
    throw new Error("Company accounting method is not QuickBooks Online.");
  }

  const config = parseQuickbooksConfig(company.quickbooksConfigJson);
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: input.invoiceId, companyId: input.companyId },
    include: {
      customer: true,
      load: { include: { charges: true } }
    }
  });

  try {
    const customerRef = await ensureCustomer(input.companyId, invoice.customerId);
    const lines =
      invoice.load.charges.length > 0
        ? invoice.load.charges.map((charge) => ({
            Amount: centsToAmount(charge.amountCents),
            DetailType: "SalesItemLineDetail",
            Description: charge.label || charge.chargeType,
            SalesItemLineDetail: {
              ItemRef: { name: config.incomeItem || "Freight" },
              Qty: 1,
              UnitPrice: centsToAmount(charge.amountCents)
            }
          }))
        : [
            {
              Amount: centsToAmount(invoice.totalCents),
              DetailType: "SalesItemLineDetail",
              Description: `Load ${invoice.load.loadNumber}`,
              SalesItemLineDetail: {
                ItemRef: { name: config.incomeItem || "Freight" },
                Qty: 1,
                UnitPrice: centsToAmount(invoice.totalCents)
              }
            }
          ];

    let qboId = invoice.externalQboId;
    if (qboId) {
      const existing = await qboRequest<{ Invoice: { Id: string; SyncToken: string } }>(
        input.companyId,
        `/invoice/${qboId}`,
        { query: { minorversion: "65" } }
      );
      const updated = await qboRequest<{ Invoice: { Id: string } }>(input.companyId, "/invoice", {
        method: "POST",
        query: { minorversion: "65" },
        body: JSON.stringify({
          Id: qboId,
          SyncToken: existing.Invoice.SyncToken,
          DocNumber: invoice.invoiceNo,
          TxnDate: formatQboDate(invoice.issuedAt),
          DueDate: formatQboDate(invoice.dueAt),
          CustomerRef: { value: customerRef },
          PrivateNote: `TMS Load ${invoice.load.loadNumber}`,
          Line: lines
        })
      });
      qboId = updated.Invoice.Id;
    } else {
      const created = await qboRequest<{ Invoice: { Id: string } }>(input.companyId, "/invoice", {
        method: "POST",
        query: { minorversion: "65" },
        body: JSON.stringify({
          DocNumber: invoice.invoiceNo,
          TxnDate: formatQboDate(invoice.issuedAt),
          DueDate: formatQboDate(invoice.dueAt),
          CustomerRef: { value: customerRef },
          PrivateNote: `TMS Load ${invoice.load.loadNumber}`,
          Line: lines
        })
      });
      qboId = created.Invoice.Id;
    }

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { externalQboId: qboId }
    });

    await upsertAccountingExport({
      companyId: input.companyId,
      entityType: "INVOICE",
      entityId: invoice.id,
      method: "ONLINE",
      status: "SYNCED",
      externalId: qboId,
      exportedByUserId: input.userId
    });

    return qboId;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown QuickBooks error";
    await upsertAccountingExport({
      companyId: input.companyId,
      entityType: "INVOICE",
      entityId: invoice.id,
      method: "ONLINE",
      status: "ERROR",
      message,
      exportedByUserId: input.userId
    });
    throw error;
  }
}

export async function pushCarrierBillToQuickbooks(input: {
  companyId: string;
  billId: string;
  userId?: string;
}) {
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: input.companyId },
    select: { quickbooksMethod: true, quickbooksConfigJson: true }
  });

  if (company.quickbooksMethod !== "ONLINE") {
    throw new Error("Company accounting method is not QuickBooks Online.");
  }

  const config = parseQuickbooksConfig(company.quickbooksConfigJson);
  const bill = await prisma.carrierBill.findUniqueOrThrow({
    where: { id: input.billId, companyId: input.companyId },
    include: { carrier: true, load: true }
  });

  try {
    const vendorRef = await ensureVendor(input.companyId, bill.carrierId);
    const amount = centsToAmount(bill.totalCents);
    const line = {
      Amount: amount,
      DetailType: "AccountBasedExpenseLineDetail",
      Description: `Load ${bill.load.loadNumber} - ${config.expenseItem || "Purchased Transportation"}`,
      AccountBasedExpenseLineDetail: {
        AccountRef: { name: config.purchasedTransportation }
      }
    };

    let qboId = bill.externalQboId;
    if (qboId) {
      const existing = await qboRequest<{ Bill: { Id: string; SyncToken: string } }>(
        input.companyId,
        `/bill/${qboId}`,
        { query: { minorversion: "65" } }
      );
      const updated = await qboRequest<{ Bill: { Id: string } }>(input.companyId, "/bill", {
        method: "POST",
        query: { minorversion: "65" },
        body: JSON.stringify({
          Id: qboId,
          SyncToken: existing.Bill.SyncToken,
          DocNumber: bill.billNo,
          TxnDate: formatQboDate(bill.receivedAt),
          DueDate: formatQboDate(bill.dueAt),
          VendorRef: { value: vendorRef },
          PrivateNote: `TMS Load ${bill.load.loadNumber}`,
          Line: [line]
        })
      });
      qboId = updated.Bill.Id;
    } else {
      const created = await qboRequest<{ Bill: { Id: string } }>(input.companyId, "/bill", {
        method: "POST",
        query: { minorversion: "65" },
        body: JSON.stringify({
          DocNumber: bill.billNo,
          TxnDate: formatQboDate(bill.receivedAt),
          DueDate: formatQboDate(bill.dueAt),
          VendorRef: { value: vendorRef },
          PrivateNote: `TMS Load ${bill.load.loadNumber}`,
          Line: [line]
        })
      });
      qboId = created.Bill.Id;
    }

    await prisma.carrierBill.update({
      where: { id: bill.id },
      data: { externalQboId: qboId }
    });

    await upsertAccountingExport({
      companyId: input.companyId,
      entityType: "CARRIER_BILL",
      entityId: bill.id,
      method: "ONLINE",
      status: "SYNCED",
      externalId: qboId,
      exportedByUserId: input.userId
    });

    return qboId;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown QuickBooks error";
    await upsertAccountingExport({
      companyId: input.companyId,
      entityType: "CARRIER_BILL",
      entityId: bill.id,
      method: "ONLINE",
      status: "ERROR",
      message,
      exportedByUserId: input.userId
    });
    throw error;
  }
}

export async function reconcileQuickbooksPayments(input: {
  companyId: string;
  markInvoicePaid: (invoiceId: string) => Promise<void>;
  markCarrierBillPaid: (billId: string) => Promise<void>;
}) {
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: input.companyId },
    select: { quickbooksMethod: true }
  });
  if (company.quickbooksMethod !== "ONLINE") {
    throw new Error("Company accounting method is not QuickBooks Online.");
  }

  const exports = await prisma.accountingExport.findMany({
    where: {
      companyId: input.companyId,
      method: "ONLINE",
      status: "SYNCED",
      externalId: { not: null }
    }
  });

  let invoicesMarked = 0;
  let billsMarked = 0;

  for (const row of exports) {
    if (!row.externalId) continue;

    if (row.entityType === "INVOICE") {
      const invoice = await prisma.invoice.findFirst({
        where: { id: row.entityId, companyId: input.companyId }
      });
      if (!invoice || invoice.status === "PAID" || invoice.status === "VOID") continue;

      const remote = await qboRequest<{ Invoice: { Balance?: number } }>(
        input.companyId,
        `/invoice/${row.externalId}`,
        { query: { minorversion: "65" } }
      );
      if ((remote.Invoice.Balance ?? 1) === 0) {
        await input.markInvoicePaid(invoice.id);
        invoicesMarked += 1;
      }
    }

    if (row.entityType === "CARRIER_BILL") {
      const bill = await prisma.carrierBill.findFirst({
        where: { id: row.entityId, companyId: input.companyId }
      });
      if (!bill || bill.status === "PAID" || bill.status === "VOID") continue;

      const remote = await qboRequest<{ Bill: { Balance?: number } }>(
        input.companyId,
        `/bill/${row.externalId}`,
        { query: { minorversion: "65" } }
      );
      if ((remote.Bill.Balance ?? 1) === 0) {
        await input.markCarrierBillPaid(bill.id);
        billsMarked += 1;
      }
    }
  }

  return { invoicesMarked, billsMarked };
}
