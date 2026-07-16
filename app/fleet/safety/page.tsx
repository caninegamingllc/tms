import { PageHeader } from "@/components/page-header";
import { createSafetyEvent } from "@/lib/safety-actions";
import { SAFETY_EVENT_TYPES, driverDisplayName } from "@/lib/fleet-constants";
import { prisma } from "@/lib/db";
import { formatDate, humanize } from "@/lib/format";
import { requirePlanFeature } from "@/lib/permissions";

export default async function FleetSafetyPage({
  searchParams
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const user = await requirePlanFeature("safety_records");
  const params = await searchParams;

  const [events, drivers, trucks, trailers] = await Promise.all([
    prisma.safetyEvent.findMany({
      where: { companyId: user.companyId },
      include: {
        driver: true,
        truck: true,
        trailer: true,
        load: { select: { id: true, loadNumber: true } }
      },
      orderBy: { occurredAt: "desc" },
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
        title="Safety"
        description="Accidents, incidents, roadside inspections, and violations for CSA-style tracking."
      />
      {params.saved ? (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          Safety event saved.
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="card">
          <h2 className="mb-4 text-lg font-semibold">Register</h2>
          {events.length === 0 ? (
            <p className="muted">No safety events recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">Driver / equipment</th>
                    <th className="py-2">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr key={event.id} className="border-b border-border/60 align-top">
                      <td className="py-2.5 pr-3 whitespace-nowrap">{formatDate(event.occurredAt)}</td>
                      <td className="py-2.5 pr-3">
                        <span className="badge bg-slate-100 text-slate-700">{humanize(event.eventType)}</span>
                        {event.dotRecordable ? (
                          <p className="mt-1 text-xs font-semibold text-rose-700">DOT recordable</p>
                        ) : null}
                      </td>
                      <td className="py-2.5 pr-3">
                        {event.driver ? driverDisplayName(event.driver) : "—"}
                        <p className="text-xs text-muted-foreground">
                          {[
                            event.truck ? `Tractor ${event.truck.unitNumber}` : null,
                            event.trailer ? `Trailer ${event.trailer.unitNumber}` : null,
                            event.load ? `Load ${event.load.loadNumber}` : null
                          ]
                            .filter(Boolean)
                            .join(" · ") || "No equipment linked"}
                        </p>
                      </td>
                      <td className="py-2.5">{event.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="mb-4 text-lg font-semibold">Record event</h2>
          <form action={createSafetyEvent} className="grid gap-3">
            <label className="grid gap-1">
              <span className="label">Type</span>
              <select className="input" name="eventType" defaultValue="ACCIDENT">
                {SAFETY_EVENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {humanize(type)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="label">Date</span>
              <input
                className="input"
                name="occurredAt"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </label>
            <label className="grid gap-1">
              <span className="label">Driver</span>
              <select className="input" name="driverId" defaultValue="">
                <option value="">None</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driverDisplayName(driver)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="label">Tractor</span>
              <select className="input" name="truckId" defaultValue="">
                <option value="">None</option>
                {trucks.map((truck) => (
                  <option key={truck.id} value={truck.id}>
                    {truck.unitNumber}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="label">Trailer</span>
              <select className="input" name="trailerId" defaultValue="">
                <option value="">None</option>
                {trailers.map((trailer) => (
                  <option key={trailer.id} value={trailer.id}>
                    {trailer.unitNumber}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="label">Severity</span>
              <input className="input" name="severity" placeholder="Minor / Major / Fatality" />
            </label>
            <label className="grid gap-1">
              <span className="label">Location</span>
              <input className="input" name="location" />
            </label>
            <label className="grid gap-1">
              <span className="label">Claim #</span>
              <input className="input" name="claimNumber" />
            </label>
            <label className="grid gap-1">
              <span className="label">Description</span>
              <textarea className="input min-h-[90px]" name="description" required />
            </label>
            <label className="grid gap-1">
              <span className="label">Resolution notes</span>
              <textarea className="input min-h-[70px]" name="resolutionNotes" />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="dotRecordable" />
              DOT recordable
            </label>
            <button className="btn" type="submit">
              Save event
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
