import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { CreateTrailerPanel, FleetListLink } from "@/components/fleet-forms";
import { requirePlanFeature } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { formatDate, humanize } from "@/lib/format";

export default async function FleetTrailersPage({
  searchParams
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const user = await requirePlanFeature("fleet_assets");
  const params = await searchParams;
  const trailers = await prisma.trailer.findMany({
    where: { companyId: user.companyId },
    orderBy: [{ status: "asc" }, { unitNumber: "asc" }]
  });

  return (
    <>
      <PageHeader
        title="Trailers"
        description="Trailer registry with VIN, plate, type, and inspection / insurance expirations."
      />
      {params.saved ? (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          Trailer saved.
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="card">
          <h2 className="mb-4 text-lg font-semibold">Trailer roster</h2>
          {trailers.length === 0 ? (
            <p className="muted">No trailers yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3">Unit</th>
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">Y/M/M</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2">Inspection</th>
                  </tr>
                </thead>
                <tbody>
                  {trailers.map((trailer) => (
                    <tr key={trailer.id} className="border-b border-border/60">
                      <td className="py-2.5 pr-3">
                        <FleetListLink href={`/fleet/trailers/${trailer.id}`}>
                          {trailer.unitNumber}
                        </FleetListLink>
                      </td>
                      <td className="py-2.5 pr-3">{trailer.trailerType}</td>
                      <td className="py-2.5 pr-3">
                        {[trailer.year, trailer.make, trailer.model].filter(Boolean).join(" ") || "—"}
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className="badge bg-slate-100 text-slate-700">{humanize(trailer.status)}</span>
                      </td>
                      <td className="py-2.5">{formatDate(trailer.annualInspectionExpiresAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            <Link href="/fleet/compliance" className="font-semibold text-primary underline">
              Compliance dashboard
            </Link>
          </p>
        </div>

        <div className="card">
          <h2 className="mb-4 text-lg font-semibold">Add trailer</h2>
          <CreateTrailerPanel />
        </div>
      </div>
    </>
  );
}
