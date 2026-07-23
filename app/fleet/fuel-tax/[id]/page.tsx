import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { DatePicker } from "@/components/ui/date-picker";
import {
  addIftaFuelPurchase,
  addIftaTrip,
  deleteIftaFuelPurchase,
  deleteIftaTrip,
  importLoadMilesToIfta,
  updateIftaQuarterStatus
} from "@/lib/ifta-actions";
import { IFTA_JURISDICTIONS, buildIftaWorksheet } from "@/lib/ifta-worksheet";
import { driverDisplayName } from "@/lib/fleet-constants";
import { formatLocalDate } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { formatDate, formatMoney, humanize } from "@/lib/format";
import { requirePlanFeature } from "@/lib/permissions";

export default async function IftaQuarterDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const user = await requirePlanFeature("fuel_tax_ifta");
  const { id } = await params;
  const query = await searchParams;

  const quarter = await prisma.iftaQuarter.findFirst({
    where: { id, companyId: user.companyId },
    include: {
      trips: {
        include: { truck: true, driver: true, load: { select: { loadNumber: true } } },
        orderBy: { startAt: "desc" }
      },
      fuelPurchases: { orderBy: { purchasedAt: "desc" } }
    }
  });
  if (!quarter) notFound();

  const [trucks, drivers, recentLoads] = await Promise.all([
    prisma.truck.findMany({
      where: { companyId: user.companyId, status: "ACTIVE" },
      orderBy: { unitNumber: "asc" }
    }),
    prisma.driver.findMany({
      where: { companyId: user.companyId, status: "ACTIVE" },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
    }),
    prisma.load.findMany({
      where: {
        companyId: user.companyId,
        status: { in: ["DELIVERED", "INVOICED", "PAID"] }
      },
      orderBy: { deliveryDate: "desc" },
      take: 80,
      select: { id: true, loadNumber: true, pickupDate: true, deliveryDate: true, routeStateMiles: true }
    })
  ]);

  const importableLoads = recentLoads.filter((load) => {
    const miles = load.routeStateMiles;
    return miles && typeof miles === "object" && !Array.isArray(miles) && Object.keys(miles).length > 0;
  });

  const worksheet = buildIftaWorksheet({
    trips: quarter.trips.map((t) => ({ jurisdiction: t.jurisdiction, miles: t.miles })),
    fuels: quarter.fuelPurchases.map((f) => ({
      jurisdiction: f.jurisdiction,
      gallons: f.gallons
    }))
  });

  const locked = quarter.status === "FILED";

  return (
    <>
      <PageHeader
        title={`IFTA Q${quarter.quarter} ${quarter.year}`}
        description="Jurisdiction miles, fuel purchases, and tax worksheet."
      />
      <p className="mb-4 text-sm">
        <Link href="/fleet/fuel-tax" className="font-semibold text-primary underline">
          ← Fuel tax
        </Link>
      </p>
      {query.saved ? (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          Saved.
        </div>
      ) : null}

      <div className="card mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="badge bg-slate-100 text-slate-700">{humanize(quarter.status)}</span>
          {quarter.filedAt ? (
            <p className="mt-2 text-sm text-muted-foreground">Filed {formatDate(quarter.filedAt)}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/api/fleet/ifta/${quarter.id}/worksheet`}
            className="btn-secondary"
            target="_blank"
            rel="noreferrer"
          >
            Export worksheet
          </Link>
          {!locked ? (
            <form action={updateIftaQuarterStatus}>
              <input type="hidden" name="quarterId" value={quarter.id} />
              <input type="hidden" name="status" value="FILED" />
              <button className="btn" type="submit">
                Mark filed
              </button>
            </form>
          ) : (
            <form action={updateIftaQuarterStatus}>
              <input type="hidden" name="quarterId" value={quarter.id} />
              <input type="hidden" name="status" value="IN_PROGRESS" />
              <button className="btn-secondary" type="submit">
                Reopen
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="card mb-6">
        <h2 className="mb-3 text-lg font-semibold">Worksheet summary</h2>
        <div className="mb-4 grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-muted p-3">
            <p className="text-xs text-muted-foreground">Total miles</p>
            <p className="text-xl font-semibold">{worksheet.totalMiles}</p>
          </div>
          <div className="rounded-xl bg-muted p-3">
            <p className="text-xs text-muted-foreground">Gallons purchased</p>
            <p className="text-xl font-semibold">{worksheet.totalGallons}</p>
          </div>
          <div className="rounded-xl bg-muted p-3">
            <p className="text-xs text-muted-foreground">Fleet MPG</p>
            <p className="text-xl font-semibold">{worksheet.fleetMpg}</p>
          </div>
          <div className="rounded-xl bg-muted p-3">
            <p className="text-xs text-muted-foreground">Est. tax due</p>
            <p className="text-xl font-semibold">{formatMoney(worksheet.taxDueCents)}</p>
          </div>
        </div>
        {worksheet.rows.length === 0 ? (
          <p className="muted">Add trips and fuel to build the worksheet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-2">Juris</th>
                  <th className="py-2 pr-2">Miles</th>
                  <th className="py-2 pr-2">Taxable gal</th>
                  <th className="py-2 pr-2">Paid gal</th>
                  <th className="py-2 pr-2">Net gal</th>
                  <th className="py-2 pr-2">Rate¢</th>
                  <th className="py-2">Tax</th>
                </tr>
              </thead>
              <tbody>
                {worksheet.rows.map((row) => (
                  <tr key={row.jurisdiction} className="border-b border-border/60">
                    <td className="py-2 pr-2 font-semibold">{row.jurisdiction}</td>
                    <td className="py-2 pr-2">{row.totalMiles}</td>
                    <td className="py-2 pr-2">{row.taxableGallons}</td>
                    <td className="py-2 pr-2">{row.taxPaidGallons}</td>
                    <td className="py-2 pr-2">{row.netTaxableGallons}</td>
                    <td className="py-2 pr-2">{row.rateCents}</td>
                    <td className="py-2">{formatMoney(row.taxDueCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Tax rates are illustrative defaults — verify current IFTA rates before filing.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-4 text-lg font-semibold">Jurisdiction miles</h2>
          {quarter.trips.length === 0 ? (
            <p className="muted mb-4">No trip miles yet.</p>
          ) : (
            <div className="mb-4 max-h-72 overflow-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-2">Juris</th>
                    <th className="py-2 pr-2">Miles</th>
                    <th className="py-2 pr-2">Asset</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {quarter.trips.map((trip) => (
                    <tr key={trip.id} className="border-b border-border/60">
                      <td className="py-2 pr-2">{trip.jurisdiction}</td>
                      <td className="py-2 pr-2">{trip.miles}</td>
                      <td className="py-2 pr-2 text-xs text-muted-foreground">
                        {[
                          trip.truck ? `T${trip.truck.unitNumber}` : null,
                          trip.driver ? driverDisplayName(trip.driver) : null,
                          trip.load ? trip.load.loadNumber : null
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </td>
                      <td className="py-2">
                        {!locked ? (
                          <form action={deleteIftaTrip}>
                            <input type="hidden" name="quarterId" value={quarter.id} />
                            <input type="hidden" name="tripId" value={trip.id} />
                            <button type="submit" className="text-xs font-semibold text-rose-700 underline">
                              Remove
                            </button>
                          </form>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!locked ? (
            <>
              <form action={addIftaTrip} className="grid gap-3 border-t border-border pt-4">
                <input type="hidden" name="quarterId" value={quarter.id} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="label">Jurisdiction</span>
                    <select className="input" name="jurisdiction" required defaultValue="TX">
                      {IFTA_JURISDICTIONS.map((j) => (
                        <option key={j} value={j}>
                          {j}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1">
                    <span className="label">Miles</span>
                    <input className="input" name="miles" type="number" step="0.1" required />
                  </label>
                  <label className="grid gap-1">
                    <span className="label">Date</span>
                    <DatePicker
                      name="startAt"
                      defaultValue={formatLocalDate(new Date())}
                      placeholder="Trip date"
                    />
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
                  <label className="grid gap-1 sm:col-span-2">
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
                </div>
                <button className="btn" type="submit">
                  Add miles
                </button>
              </form>

              <form action={importLoadMilesToIfta} className="mt-4 grid gap-3 border-t border-border pt-4">
                <input type="hidden" name="quarterId" value={quarter.id} />
                <label className="grid gap-1">
                  <span className="label">Import from load (state miles)</span>
                  <select className="input" name="loadId" required defaultValue="">
                    <option value="" disabled>
                      Select load
                    </option>
                    {importableLoads.map((load) => (
                      <option key={load.id} value={load.id}>
                        {load.loadNumber}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="btn-secondary" type="submit">
                  Import load miles
                </button>
              </form>
            </>
          ) : null}
        </div>

        <div className="card">
          <h2 className="mb-4 text-lg font-semibold">Fuel purchases</h2>
          {quarter.fuelPurchases.length === 0 ? (
            <p className="muted mb-4">No fuel purchases yet.</p>
          ) : (
            <div className="mb-4 max-h-72 overflow-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-2">Date</th>
                    <th className="py-2 pr-2">Juris</th>
                    <th className="py-2 pr-2">Gal</th>
                    <th className="py-2 pr-2">Cost</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {quarter.fuelPurchases.map((fuel) => (
                    <tr key={fuel.id} className="border-b border-border/60">
                      <td className="py-2 pr-2">{formatDate(fuel.purchasedAt)}</td>
                      <td className="py-2 pr-2">{fuel.jurisdiction}</td>
                      <td className="py-2 pr-2">{fuel.gallons}</td>
                      <td className="py-2 pr-2">{formatMoney(fuel.costCents)}</td>
                      <td className="py-2">
                        {!locked ? (
                          <form action={deleteIftaFuelPurchase}>
                            <input type="hidden" name="quarterId" value={quarter.id} />
                            <input type="hidden" name="purchaseId" value={fuel.id} />
                            <button type="submit" className="text-xs font-semibold text-rose-700 underline">
                              Remove
                            </button>
                          </form>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!locked ? (
            <form action={addIftaFuelPurchase} className="grid gap-3 border-t border-border pt-4">
              <input type="hidden" name="quarterId" value={quarter.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1">
                  <span className="label">Jurisdiction</span>
                  <select className="input" name="jurisdiction" required defaultValue="TX">
                    {IFTA_JURISDICTIONS.map((j) => (
                      <option key={j} value={j}>
                        {j}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="label">Gallons</span>
                  <input className="input" name="gallons" type="number" step="0.01" required />
                </label>
                <label className="grid gap-1">
                  <span className="label">Date</span>
                  <DatePicker
                    name="purchasedAt"
                    defaultValue={formatLocalDate(new Date())}
                    placeholder="Purchase date"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="label">Cost (USD)</span>
                  <input className="input" name="cost" type="number" step="0.01" defaultValue="0" />
                </label>
                <label className="grid gap-1 sm:col-span-2">
                  <span className="label">Vendor</span>
                  <input className="input" name="vendor" />
                </label>
              </div>
              <button className="btn" type="submit">
                Add fuel purchase
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </>
  );
}
