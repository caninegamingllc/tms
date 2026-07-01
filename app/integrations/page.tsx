import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDate, humanize } from "@/lib/format";

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
  const user = await requireUser();
  const integrations = await prisma.integrationAccount.findMany({
    where: { companyId: user.companyId },
    orderBy: { provider: "asc" }
  });

  return (
    <>
      <PageHeader
        title="Integrations"
        description="Placeholders for external services commonly used by freight brokers. These are ready for real API credentials later."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {integrations.map((integration) => (
          <section key={integration.id} className="card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-ink">{integration.displayName}</h2>
                <p className="muted">{humanize(integration.provider)}</p>
              </div>
              <span className="badge bg-slate-100 text-slate-700">{integration.status}</span>
            </div>
            <p className="mt-4 text-sm text-slate-700">{integration.notes}</p>
            <div className="mt-4 rounded-2xl bg-soft p-4">
              <p className="text-sm font-semibold text-ink">Planned Capabilities</p>
              <ul className="mt-3 grid gap-2 text-sm text-slate-700">
                {(capabilities[integration.provider] ?? ["API connection", "Status sync"]).map(
                  (capability) => (
                    <li key={capability}>- {capability}</li>
                  )
                )}
              </ul>
            </div>
            <p className="mt-4 text-xs text-muted">Updated {formatDate(integration.updatedAt)}</p>
          </section>
        ))}
      </div>
    </>
  );
}
