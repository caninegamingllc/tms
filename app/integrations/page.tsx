import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { TileBoard, Tile } from "@/components/tile-board";
import { requirePlanFeature } from "@/lib/permissions";
import { canManageUsers } from "@/lib/scope";
import { prisma } from "@/lib/db";
import { formatDate, humanize } from "@/lib/format";
import { getCompanyQuickbooksMethod } from "@/lib/quickbooks/exports";
import { integrationsTiles } from "@/lib/tile-defaults";
import { loadPageLayouts } from "@/lib/ui-preferences-load";

const capabilities: Record<string, string[]> = {
  DAT: ["Post available loads", "Search trucks", "Import market rates"],
  TRUCKSTOP: ["Post loads", "Find capacity", "Rate intelligence"],
  QUICKBOOKS: ["Sync customer invoices", "Sync carrier bills", "Reconcile payments"],
  TRUCKER_TOOLS: ["Driver tracking", "Document capture", "Automated check calls"],
  ELD: ["Location pings", "ETA updates", "Asset visibility"],
  FACTORING: ["Quick pay", "Carrier funding", "Payment status callbacks"],
  EMAIL: ["Send rate confirmations", "Send invoice packets", "Capture replies"]
};

export default async function IntegrationsPage() {
  const user = await requirePlanFeature("marketplace_integrations");
  const [integrations, quickbooksMethod, layouts] = await Promise.all([
    prisma.integrationAccount.findMany({
      where: { companyId: user.companyId },
      orderBy: { provider: "asc" }
    }),
    getCompanyQuickbooksMethod(user.companyId),
    loadPageLayouts("integrations")
  ]);
  const isAdmin = canManageUsers(user);
  const providerIds = integrations.map((integration) => integration.id);
  const tiles = (() => {
    const base = integrationsTiles(providerIds).map((tile) => {
      if (!tile.id.startsWith("provider-")) {
        return tile;
      }
      const id = tile.id.slice("provider-".length);
      const integration = integrations.find((entry) => entry.id === id);
      return {
        ...tile,
        title: integration?.displayName ?? humanize(integration?.provider ?? tile.title ?? id)
      };
    });
    return isAdmin ? base : base.filter((tile) => tile.id !== "quickbooks");
  })();

  return (
    <>
      <PageHeader
        title="Integrations"
        description="External services used by the brokerage. Connect personal email under Email settings. Configure QuickBooks export under Admin Accounting Settings."
      />

      <TileBoard pageId="integrations" tiles={tiles} initialLayouts={layouts}>
        {isAdmin ? (
          <Tile id="quickbooks">
            <p className="muted">
              Active accounting method:{" "}
              <span className="font-semibold text-foreground">
                {quickbooksMethod === "ONLINE"
                  ? "QuickBooks Online"
                  : quickbooksMethod === "IIF"
                    ? "IIF (Desktop)"
                    : "Not configured"}
              </span>
            </p>
            <div className="mt-4">
              <Link href="/admin/accounting" className="btn">
                Open Accounting Settings
              </Link>
            </div>
          </Tile>
        ) : null}

        {integrations.map((integration) => (
          <Tile key={integration.id} id={`provider-${integration.id}`}>
            <div className="flex items-start justify-between gap-3">
              <p className="muted">{humanize(integration.provider)}</p>
              <span className="badge bg-slate-100 text-slate-700">{integration.status}</span>
            </div>
            <p className="mt-4 text-sm text-slate-700">{integration.notes}</p>
            {integration.provider === "QUICKBOOKS" && integration.lastError ? (
              <p className="mt-2 text-sm text-rose-700">{integration.lastError}</p>
            ) : null}
            <div className="mt-4 rounded-2xl bg-muted p-4">
              <p className="text-sm font-semibold text-foreground">Capabilities</p>
              <ul className="mt-3 grid gap-2 text-sm text-slate-700">
                {(capabilities[integration.provider] ?? ["API connection", "Status sync"]).map(
                  (capability) => (
                    <li key={capability}>- {capability}</li>
                  )
                )}
              </ul>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">Updated {formatDate(integration.updatedAt)}</p>
          </Tile>
        ))}
      </TileBoard>
    </>
  );
}
