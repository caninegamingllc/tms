import Link from "next/link";
import { SettingsLayout, SettingsSectionHeading } from "@/components/settings-layout";
import { TileBoard, Tile } from "@/components/tile-board";
import { connectEldProvider, disconnectEldProvider, syncEldProvider } from "@/lib/eld-actions";
import { ELD_INTEGRATION_PROVIDERS } from "@/lib/fleet-constants";
import { requirePlanFeature } from "@/lib/permissions";
import { planHasFeature } from "@/lib/plans";
import { canManageUsers } from "@/lib/scope";
import { prisma } from "@/lib/db";
import { formatDate, formatDateTime, humanize } from "@/lib/format";
import { getCompanyQuickbooksMethod } from "@/lib/quickbooks/exports";
import { getSettingsNavItems } from "@/lib/settings-nav";
import { integrationsTiles } from "@/lib/tile-defaults";
import { loadPageLayouts } from "@/lib/ui-preferences-load";

const capabilities: Record<string, string[]> = {
  DAT: ["Post available loads", "Search trucks", "Import market rates"],
  TRUCKSTOP: ["Post loads", "Find capacity", "Rate intelligence"],
  QUICKBOOKS: ["Sync customer invoices", "Sync carrier bills", "Reconcile payments"],
  TRUCKER_TOOLS: ["Driver tracking", "Document capture", "Automated check calls"],
  ELD: ["Location pings", "ETA updates", "Asset visibility"],
  SAMSARA: ["GPS location", "HOS", "Asset visibility (Phase 2 API)"],
  MOTIVE: ["GPS location", "HOS", "Asset visibility (Phase 2 API)"],
  GEOTAB: ["GPS location", "HOS", "Asset visibility (Phase 2 API)"],
  FACTORING: ["Quick pay", "Carrier funding", "Payment status callbacks"],
  EMAIL: ["Send rate confirmations", "Send invoice packets", "Capture replies"]
};

const ELD_PROVIDER_SET = new Set<string>(ELD_INTEGRATION_PROVIDERS);

export default async function IntegrationsPage({
  searchParams
}: {
  searchParams: Promise<{ saved?: string; synced?: string }>;
}) {
  const user = await requirePlanFeature("marketplace_integrations");
  const params = await searchParams;
  const showEld = planHasFeature(user.plan, "eld_integrations");

  if (showEld) {
    for (const [provider, displayName, notes] of [
      ["SAMSARA", "Samsara ELD", "Phase 2: GPS location, HOS, and asset visibility via Samsara API."],
      ["MOTIVE", "Motive ELD", "Phase 2: GPS location, HOS, and asset visibility via Motive API."],
      ["GEOTAB", "Geotab ELD", "Phase 2: GPS location, HOS, and asset visibility via Geotab API."]
    ] as const) {
      await prisma.integrationAccount.upsert({
        where: {
          companyId_provider: { companyId: user.companyId, provider }
        },
        create: {
          companyId: user.companyId,
          provider,
          displayName,
          status: "Not Connected",
          notes
        },
        update: {}
      });
    }
  }

  const [integrationsRaw, quickbooksMethod, layouts] = await Promise.all([
    prisma.integrationAccount.findMany({
      where: { companyId: user.companyId },
      orderBy: { provider: "asc" }
    }),
    getCompanyQuickbooksMethod(user.companyId),
    loadPageLayouts("integrations")
  ]);

  const integrations = integrationsRaw.filter((integration) => {
    if (ELD_PROVIDER_SET.has(integration.provider)) {
      return showEld;
    }
    return true;
  });

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
    <SettingsLayout items={getSettingsNavItems(user)}>
      <SettingsSectionHeading
        title="Integrations"
        description="External services used by the brokerage. Connect personal email under Email. Configure QuickBooks export under Accounting."
      />
      {params.saved ? (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          Integration saved.
        </div>
      ) : null}
      {params.synced ? (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          ELD sync finished.
        </div>
      ) : null}

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

        {integrations.map((integration) => {
          const isEld = ELD_PROVIDER_SET.has(integration.provider);
          return (
            <Tile key={integration.id} id={`provider-${integration.id}`}>
              <div className="flex items-start justify-between gap-3">
                <p className="muted">{humanize(integration.provider)}</p>
                <span className="badge bg-slate-100 text-slate-700">{integration.status}</span>
              </div>
              <p className="mt-4 text-sm text-slate-700">{integration.notes}</p>
              {integration.lastError ? (
                <p className="mt-2 text-sm text-rose-700">{integration.lastError}</p>
              ) : null}
              {integration.lastSyncAt ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Last sync {formatDateTime(integration.lastSyncAt)}
                  {integration.apiKeyLast4 ? ` · key …${integration.apiKeyLast4}` : ""}
                </p>
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

              {isEld && isAdmin ? (
                <div className="mt-4 grid gap-3 border-t border-border pt-4">
                  {integration.status !== "Connected" ? (
                    <form action={connectEldProvider} className="grid gap-2">
                      <input type="hidden" name="provider" value={integration.provider} />
                      <label className="grid gap-1">
                        <span className="label">API token</span>
                        <input
                          className="input"
                          name="apiToken"
                          type="password"
                          autoComplete="off"
                          required
                          placeholder="Bearer / API token"
                        />
                      </label>
                      <button className="btn" type="submit">
                        Connect
                      </button>
                    </form>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <form action={syncEldProvider}>
                        <input type="hidden" name="provider" value={integration.provider} />
                        <button className="btn" type="submit">
                          Sync now
                        </button>
                      </form>
                      <form action={disconnectEldProvider}>
                        <input type="hidden" name="provider" value={integration.provider} />
                        <button className="btn-secondary" type="submit">
                          Disconnect
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              ) : null}

              <p className="mt-4 text-xs text-muted-foreground">
                Updated {formatDate(integration.updatedAt)}
              </p>
            </Tile>
          );
        })}
      </TileBoard>
    </SettingsLayout>
  );
}
