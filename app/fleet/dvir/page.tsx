import { PageHeader } from "@/components/page-header";
import { createDvirReport } from "@/lib/dvir-settlement-actions";
import { driverDisplayName } from "@/lib/fleet-constants";
import { prisma } from "@/lib/db";
import { formatDate, formatDateTime, humanize } from "@/lib/format";
import { requirePlanFeature } from "@/lib/permissions";

export default async function FleetDvirPage({
  searchParams
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const user = await requirePlanFeature("fleet_assets");
  const params = await searchParams;

  const [reports, drivers, trucks, trailers] = await Promise.all([
    prisma.dvirReport.findMany({
      where: { companyId: user.companyId },
      include: { driver: true, truck: true, trailer: true },
      orderBy: { inspectedAt: "desc" },
      take: 100
    }),
    prisma.driver.findMany({
      where: { companyId: user.companyId, status: "ACTIVE" },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
    }),
    prisma.truck.findMany({
      where: { companyId: user.companyId, status: "ACTIVE" },
      orderBy: { unitNumber: "asc" }
    }),
    prisma.trailer.findMany({
      where: { companyId: user.companyId, status: "ACTIVE" },
      orderBy: { unitNumber: "asc" }
    })
  ]);

  return (
    <>
      <PageHeader
        title="DVIR"
        description="Driver vehicle inspection reports (pre-trip / post-trip) for tractors and trailers."
      />
      {params.saved ? (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          DVIR saved.
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="card">
          <h2 className="mb-4 text-lg font-semibold">Recent inspections</h2>
          {reports.length === 0 ? (
            <p className="muted">No DVIRs yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-3">When</th>
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">Result</th>
                    <th className="py-2 pr-3">Assets</th>
                    <th className="py-2">Driver</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
                    <tr key={report.id} className="border-b border-border/60 align-top">
                      <td className="py-2.5 pr-3 whitespace-nowrap">
                        {formatDateTime(report.inspectedAt)}
                      </td>
                      <td className="py-2.5 pr-3">{humanize(report.inspectionType)}</td>
                      <td className="py-2.5 pr-3">
                        <span
                          className={`badge ${
                            report.result === "UNSATISFACTORY"
                              ? "bg-rose-100 text-rose-800"
                              : report.result === "SATISFACTORY"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {humanize(report.result)}
                        </span>
                        {!report.certifiedSafe ? (
                          <p className="mt-1 text-xs font-semibold text-rose-700">Not certified safe</p>
                        ) : null}
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-muted-foreground">
                        {[
                          report.truck ? `Tractor ${report.truck.unitNumber}` : null,
                          report.trailer ? `Trailer ${report.trailer.unitNumber}` : null,
                          report.odometer != null ? `${report.odometer} mi` : null
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </td>
                      <td className="py-2.5">
                        {report.driver ? driverDisplayName(report.driver) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="mb-4 text-lg font-semibold">New DVIR</h2>
          <form action={createDvirReport} className="grid gap-3">
            <label className="grid gap-1">
              <span className="label">Inspection type</span>
              <select className="input" name="inspectionType" defaultValue="PRE_TRIP">
                <option value="PRE_TRIP">Pre-trip</option>
                <option value="POST_TRIP">Post-trip</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <label className="grid gap-1">
              <span className="label">Result</span>
              <select className="input" name="result" defaultValue="SATISFACTORY">
                <option value="SATISFACTORY">Satisfactory</option>
                <option value="DEFECTS_CORRECTED">Defects corrected</option>
                <option value="UNSATISFACTORY">Unsatisfactory</option>
              </select>
            </label>
            <label className="grid gap-1">
              <span className="label">Date / time</span>
              <input
                className="input"
                name="inspectedAt"
                type="datetime-local"
                defaultValue={new Date().toISOString().slice(0, 16)}
              />
            </label>
            <label className="grid gap-1">
              <span className="label">Driver</span>
              <select className="input" name="driverId" defaultValue="">
                <option value="">None</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {driverDisplayName(d)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="label">Tractor</span>
              <select className="input" name="truckId" defaultValue="">
                <option value="">None</option>
                {trucks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.unitNumber}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="label">Trailer</span>
              <select className="input" name="trailerId" defaultValue="">
                <option value="">None</option>
                {trailers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.unitNumber}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="label">Odometer</span>
              <input className="input" name="odometer" type="number" />
            </label>
            <label className="grid gap-1">
              <span className="label">Defects (one per line)</span>
              <textarea className="input min-h-[80px]" name="defects" />
            </label>
            <label className="grid gap-1">
              <span className="label">Remarks</span>
              <textarea className="input min-h-[70px]" name="remarks" />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="certifiedSafe" defaultChecked />
              Vehicle certified safe to operate
            </label>
            <button className="btn" type="submit">
              Save DVIR
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
