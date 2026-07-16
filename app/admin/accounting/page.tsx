import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { FactoringCompaniesAdmin } from "@/components/factoring-companies-admin";
import { TileBoard, Tile } from "@/components/tile-board";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePlanFeature } from "@/lib/permissions";
import {
  disconnectQuickbooksAction,
  startQuickbooksConnect,
  updateAccountingSettings
} from "@/lib/quickbooks/actions";
import { isQuickbooksOnlineConfigured } from "@/lib/quickbooks/online";
import { parseQuickbooksConfig } from "@/lib/quickbooks/types";
import { ADMIN_ACCOUNTING_TILES } from "@/lib/tile-defaults";
import { loadPageLayouts } from "@/lib/ui-preferences-load";

export default async function AdminAccountingPage({
  searchParams
}: {
  searchParams: Promise<{
    saved?: string;
    connected?: string;
    disconnected?: string;
    factorSaved?: string;
    error?: string;
  }>;
}) {
  await requirePlanFeature("factoring_admin");
  const admin = await requireAdmin();
  const params = await searchParams;

  const [company, qboAccount, factoringCompanies, layouts] = await Promise.all([
    prisma.company.findUniqueOrThrow({ where: { id: admin.companyId } }),
    prisma.integrationAccount.findUnique({
      where: {
        companyId_provider: { companyId: admin.companyId, provider: "QUICKBOOKS" }
      }
    }),
    prisma.factoringCompany.findMany({
      where: { companyId: admin.companyId },
      orderBy: { name: "asc" },
      include: { _count: { select: { carriers: true } } }
    }),
    loadPageLayouts("admin-accounting")
  ]);

  const config = parseQuickbooksConfig(company.quickbooksConfigJson);
  const method =
    company.quickbooksMethod === "ONLINE" || company.quickbooksMethod === "IIF"
      ? company.quickbooksMethod
      : "NONE";
  const qboConfigured = isQuickbooksOnlineConfigured();
  const qboConnected = qboAccount?.status === "Connected";

  return (
    <>
      <PageHeader
        title="Accounting Settings"
        description="Choose how this organization exports invoices and carrier bills to QuickBooks, and manage factoring payees."
      />

      <div className="mb-6">
        <Link href="/admin?tab=settings" className="text-sm font-semibold text-primary">
          Back to Admin
        </Link>
      </div>

      {params.error ? (
        <div className="card mb-6 border-rose-200 bg-rose-50 text-sm font-semibold text-rose-700">
          {params.error}
        </div>
      ) : null}
      {params.saved ? (
        <div className="card mb-6 border-emerald-200 bg-emerald-50 text-sm font-semibold text-emerald-800">
          Accounting settings saved. Export history for each method is preserved.
        </div>
      ) : null}
      {params.factorSaved ? (
        <div className="card mb-6 border-emerald-200 bg-emerald-50 text-sm font-semibold text-emerald-800">
          Factoring company saved.
        </div>
      ) : null}
      {params.connected ? (
        <div className="card mb-6 border-emerald-200 bg-emerald-50 text-sm font-semibold text-emerald-800">
          QuickBooks Online connected successfully.
        </div>
      ) : null}
      {params.disconnected ? (
        <div className="card mb-6 border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700">
          QuickBooks Online disconnected.
        </div>
      ) : null}

      <TileBoard pageId="admin-accounting" tiles={ADMIN_ACCOUNTING_TILES} initialLayouts={layouts}>
        <Tile id="export-method">
          <p className="muted">
            The Accounting screens show export status for the selected method only. Switching methods does
            not erase previous IIF or Online export records.
          </p>

          <div className="mt-4 grid gap-3">
            <label className="flex items-start gap-3 rounded-2xl border border-border p-4">
              <input
                type="radio"
                name="quickbooksMethod"
                value="NONE"
                form="accounting-settings-form"
                defaultChecked={method === "NONE"}
                className="mt-1"
              />
              <span>
                <span className="font-semibold text-foreground">None</span>
                <span className="muted block">
                  Hide QuickBooks export actions until a method is chosen.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-2xl border border-border p-4">
              <input
                type="radio"
                name="quickbooksMethod"
                value="ONLINE"
                form="accounting-settings-form"
                defaultChecked={method === "ONLINE"}
                className="mt-1"
              />
              <span>
                <span className="font-semibold text-foreground">QuickBooks Online</span>
                <span className="muted block">
                  Push customers, vendors, invoices, and bills through Intuit OAuth.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-2xl border border-border p-4">
              <input
                type="radio"
                name="quickbooksMethod"
                value="IIF"
                form="accounting-settings-form"
                defaultChecked={method === "IIF"}
                className="mt-1"
              />
              <span>
                <span className="font-semibold text-foreground">Export IIF (Desktop)</span>
                <span className="muted block">
                  Download `.iif` files and import them in QuickBooks Desktop via File → Utilities → Import →
                  IIF.
                </span>
              </span>
            </label>
          </div>
        </Tile>

        <Tile id="account-mapping">
          <p className="muted">
            Names must match accounts (and optional items) that already exist in your QuickBooks company
            file.
          </p>
          <form id="accounting-settings-form" action={updateAccountingSettings} className="mt-4 grid gap-3">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="label">Accounts Receivable</span>
                <input
                  name="accountsReceivable"
                  className="input"
                  defaultValue={config.accountsReceivable}
                  required
                />
              </label>
              <label className="grid gap-2">
                <span className="label">Accounts Payable</span>
                <input
                  name="accountsPayable"
                  className="input"
                  defaultValue={config.accountsPayable}
                  required
                />
              </label>
              <label className="grid gap-2">
                <span className="label">Freight Income</span>
                <input
                  name="freightIncome"
                  className="input"
                  defaultValue={config.freightIncome}
                  required
                />
              </label>
              <label className="grid gap-2">
                <span className="label">Purchased Transportation</span>
                <input
                  name="purchasedTransportation"
                  className="input"
                  defaultValue={config.purchasedTransportation}
                  required
                />
              </label>
              <label className="grid gap-2">
                <span className="label">Income Item (Online)</span>
                <input name="incomeItem" className="input" defaultValue={config.incomeItem} />
              </label>
              <label className="grid gap-2">
                <span className="label">Expense Item Label</span>
                <input name="expenseItem" className="input" defaultValue={config.expenseItem} />
              </label>
            </div>
            <div className="mt-1">
              <button type="submit" className="btn">
                Save Accounting Settings
              </button>
            </div>
          </form>
        </Tile>

        <Tile id="qb-connection">
          <p className="muted">
            Status:{" "}
            <span className="font-semibold text-foreground">
              {qboConnected ? "Connected" : "Not Connected"}
            </span>
            {qboAccount?.realmId ? ` · Company ID ${qboAccount.realmId}` : null}
          </p>
          {qboAccount?.lastError ? (
            <p className="mt-2 text-sm text-rose-700">{qboAccount.lastError}</p>
          ) : null}
          {!qboConfigured ? (
            <p className="mt-3 text-sm text-amber-800">
              Set INTUIT_CLIENT_ID, INTUIT_CLIENT_SECRET, and INTUIT_TOKEN_ENCRYPTION_KEY in the environment
              to enable OAuth.
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-3">
            {qboConfigured ? (
              <form action={startQuickbooksConnect}>
                <button type="submit" className="btn">
                  {qboConnected ? "Reconnect QuickBooks Online" : "Connect QuickBooks Online"}
                </button>
              </form>
            ) : null}
            {qboConnected ? (
              <form action={disconnectQuickbooksAction}>
                <button type="submit" className="btn-secondary">
                  Disconnect
                </button>
              </form>
            ) : null}
          </div>
        </Tile>

        <Tile id="factoring">
          <FactoringCompaniesAdmin
            companies={factoringCompanies.map((row) => ({
              id: row.id,
              name: row.name,
              nameOnCheck: row.nameOnCheck,
              phone: row.phone,
              email: row.email,
              address: row.address,
              city: row.city,
              state: row.state,
              postalCode: row.postalCode,
              status: row.status,
              carrierCount: row._count.carriers
            }))}
          />
        </Tile>
      </TileBoard>
    </>
  );
}
