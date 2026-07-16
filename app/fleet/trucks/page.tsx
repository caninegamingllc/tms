import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { CreateTruckPanel, FleetListLink } from "@/components/fleet-forms";
import { requirePlanFeature } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { formatDate, humanize } from "@/lib/format";

export default async function FleetTrucksPage({
  searchParams
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const user = await requirePlanFeature("fleet_assets");
  const params = await searchParams;
  const trucks = await prisma.truck.findMany({
    where: { companyId: user.companyId },
    orderBy: [{ status: "asc" }, { unitNumber: "asc" }]
  });

  return (
    <>
      <PageHeader
        title="Trucks"
        description="Power units with VIN, plate, registration, IRP, inspection, and insurance expirations."
      />
      {params.saved ? (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          Tractor saved.
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="card">
          <h2 className="mb-4 text-lg font-semibold">Tractor roster</h2>
          {trucks.length === 0 ? (
            <p className="muted">No tractors yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3">Unit</th>
                    <th className="py-2 pr-3">Y/M/M</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Plate</th>
                    <th className="py-2">Inspection</th>
                  </tr>
                </thead>
                <tbody>
                  {trucks.map((truck) => (
                    <tr key={truck.id} className="border-b border-border/60">
                      <td className="py-2.5 pr-3">
                        <FleetListLink href={`/fleet/trucks/${truck.id}`}>{truck.unitNumber}</FleetListLink>
                        {truck.vin ? (
                          <p className="text-xs text-muted-foreground">{truck.vin}</p>
                        ) : null}
                      </td>
                      <td className="py-2.5 pr-3">
                        {[truck.year, truck.make, truck.model].filter(Boolean).join(" ") || "—"}
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className="badge bg-slate-100 text-slate-700">{humanize(truck.status)}</span>
                      </td>
                      <td className="py-2.5 pr-3">
                        {[truck.licensePlate, truck.licenseState].filter(Boolean).join(" ") || "—"}
                      </td>
                      <td className="py-2.5">{formatDate(truck.annualInspectionExpiresAt)}</td>
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
          <h2 className="mb-4 text-lg font-semibold">Add tractor</h2>
          <CreateTruckPanel />
        </div>
      </div>
    </>
  );
}
