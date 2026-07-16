import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { CreateDriverPanel, FleetListLink } from "@/components/fleet-forms";
import { requirePlanFeature } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { driverDisplayName } from "@/lib/fleet-constants";
import { formatDate, humanize } from "@/lib/format";

export default async function FleetDriversPage({
  searchParams
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const user = await requirePlanFeature("fleet_assets");
  const params = await searchParams;
  const drivers = await prisma.driver.findMany({
    where: { companyId: user.companyId },
    orderBy: [{ status: "asc" }, { lastName: "asc" }, { firstName: "asc" }]
  });

  return (
    <>
      <PageHeader
        title="Drivers"
        description="Company drivers for fleet dispatch, CDL tracking, and Driver Qualification Files."
      />
      {params.saved ? (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          Driver saved.
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="card">
          <h2 className="mb-4 text-lg font-semibold">Driver roster</h2>
          {drivers.length === 0 ? (
            <p className="muted">No drivers yet. Add your first driver on the right.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3">Name</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">CDL exp</th>
                    <th className="py-2 pr-3">Med exp</th>
                    <th className="py-2">Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {drivers.map((driver) => (
                    <tr key={driver.id} className="border-b border-border/60">
                      <td className="py-2.5 pr-3">
                        <FleetListLink href={`/fleet/drivers/${driver.id}`}>
                          {driverDisplayName(driver)}
                        </FleetListLink>
                        {driver.employeeNumber ? (
                          <p className="text-xs text-muted-foreground">#{driver.employeeNumber}</p>
                        ) : null}
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className="badge bg-slate-100 text-slate-700">{humanize(driver.status)}</span>
                      </td>
                      <td className="py-2.5 pr-3">{formatDate(driver.cdlExpiresAt)}</td>
                      <td className="py-2.5 pr-3">{formatDate(driver.medicalExpiresAt)}</td>
                      <td className="py-2.5">{driver.phone ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            Need expirations across the fleet?{" "}
            <Link href="/fleet/compliance" className="font-semibold text-primary underline">
              Open compliance dashboard
            </Link>
            .
          </p>
        </div>

        <div className="card">
          <h2 className="mb-4 text-lg font-semibold">Add driver</h2>
          <CreateDriverPanel />
        </div>
      </div>
    </>
  );
}
