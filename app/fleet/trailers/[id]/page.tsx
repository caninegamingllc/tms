import Link from "next/link";
import { notFound } from "next/navigation";
import { TrailerForm } from "@/components/fleet-forms";
import { MaintenanceSection } from "@/components/maintenance-section";
import { PageHeader } from "@/components/page-header";
import { updateTrailer } from "@/lib/fleet-actions";
import { prisma } from "@/lib/db";
import { requirePlanFeature } from "@/lib/permissions";

export default async function FleetTrailerDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const user = await requirePlanFeature("fleet_assets");
  const { id } = await params;
  const query = await searchParams;

  const trailer = await prisma.trailer.findFirst({
    where: { id, companyId: user.companyId }
  });
  if (!trailer) notFound();

  const logs = await prisma.equipmentMaintenanceLog.findMany({
    where: { companyId: user.companyId, assetType: "TRAILER", assetId: trailer.id },
    orderBy: { performedAt: "desc" }
  });

  return (
    <>
      <PageHeader title={`Trailer ${trailer.unitNumber}`} description="Trailer details and maintenance." />
      <p className="mb-4 text-sm">
        <Link href="/fleet/trailers" className="font-semibold text-primary underline">
          ← Trailers
        </Link>
      </p>
      {query.saved ? (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          Saved.
        </div>
      ) : null}

      <div className="card">
        <h2 className="mb-4 text-lg font-semibold">Details</h2>
        <TrailerForm action={updateTrailer} trailer={trailer} />
      </div>

      <MaintenanceSection assetType="TRAILER" assetId={trailer.id} logs={logs} />
    </>
  );
}
