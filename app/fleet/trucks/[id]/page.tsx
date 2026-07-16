import Link from "next/link";
import { notFound } from "next/navigation";
import { TruckForm } from "@/components/fleet-forms";
import { MaintenanceSection } from "@/components/maintenance-section";
import { PageHeader } from "@/components/page-header";
import { updateTruck } from "@/lib/fleet-actions";
import { prisma } from "@/lib/db";
import { formatDateTime, humanize } from "@/lib/format";
import { requirePlanFeature } from "@/lib/permissions";
import { planHasFeature } from "@/lib/plans";

export default async function FleetTruckDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const user = await requirePlanFeature("fleet_assets");
  const { id } = await params;
  const query = await searchParams;

  const truck = await prisma.truck.findFirst({
    where: { id, companyId: user.companyId }
  });
  if (!truck) notFound();

  const logs = await prisma.equipmentMaintenanceLog.findMany({
    where: { companyId: user.companyId, assetType: "TRUCK", assetId: truck.id },
    orderBy: { performedAt: "desc" }
  });

  return (
    <>
      <PageHeader title={`Tractor ${truck.unitNumber}`} description="Power unit details and maintenance." />
      <p className="mb-4 text-sm">
        <Link href="/fleet/trucks" className="font-semibold text-primary underline">
          ← Trucks
        </Link>
      </p>
      {query.saved ? (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          Saved.
        </div>
      ) : null}

      <div className="card">
        <h2 className="mb-4 text-lg font-semibold">Details</h2>
        <TruckForm action={updateTruck} truck={truck} />
      </div>

      {planHasFeature(user.plan, "eld_integrations") ? (
        <div className="card mt-6">
          <h2 className="mb-3 text-lg font-semibold">ELD / telematics</h2>
          {truck.eldProvider || truck.eldAssetId ? (
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Provider</dt>
                <dd className="font-semibold">
                  {truck.eldProvider ? humanize(truck.eldProvider) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Asset ID</dt>
                <dd className="font-semibold">{truck.eldAssetId ?? "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Last location</dt>
                <dd className="font-semibold">{truck.eldLastLocation ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Last ping</dt>
                <dd className="font-semibold">{formatDateTime(truck.eldLastPingAt)}</dd>
              </div>
            </dl>
          ) : (
            <p className="muted">
              Not linked yet. Connect Samsara or Motive under Integrations and run Sync — matching
              uses unit number or VIN.
            </p>
          )}
        </div>
      ) : null}

      <MaintenanceSection assetType="TRUCK" assetId={truck.id} logs={logs} />
    </>
  );
}
