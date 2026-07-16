import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import {
  createDriverSettlement,
  updateDriverSettlementStatus
} from "@/lib/dvir-settlement-actions";
import { driverDisplayName } from "@/lib/fleet-constants";
import { prisma } from "@/lib/db";
import { formatDate, formatMoney, humanize } from "@/lib/format";
import { requirePlanFeature } from "@/lib/permissions";

export default async function FleetSettlementsPage({
  searchParams
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const user = await requirePlanFeature("fleet_dispatch");
  const params = await searchParams;

  const [settlements, drivers, loads] = await Promise.all([
    prisma.driverSettlement.findMany({
      where: { companyId: user.companyId },
      include: {
        driver: true,
        load: { select: { id: true, loadNumber: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    }),
    prisma.driver.findMany({
      where: { companyId: user.companyId, status: { not: "TERMINATED" } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
    }),
    prisma.load.findMany({
      where: {
        companyId: user.companyId,
        dispatchAssignments: { some: { driverId: { not: null } } }
      },
      orderBy: { createdAt: "desc" },
      take: 80,
      select: { id: true, loadNumber: true, revenueCents: true, routeTotalMiles: true }
    })
  ]);

  return (
    <>
      <PageHeader
        title="Driver settlements"
        description="Pay company drivers and owner-operators against loads or pay periods."
      />
      {params.saved ? (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          Settlement saved.
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="card">
          <h2 className="mb-4 text-lg font-semibold">Settlements</h2>
          {settlements.length === 0 ? (
            <p className="muted">No settlements yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-3">Driver</th>
                    <th className="py-2 pr-3">Load</th>
                    <th className="py-2 pr-3">Pay</th>
                    <th className="py-2 pr-3">Net</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {settlements.map((row) => (
                    <tr key={row.id} className="border-b border-border/60 align-top">
                      <td className="py-2.5 pr-3">
                        <Link
                          href={`/fleet/drivers/${row.driverId}`}
                          className="font-semibold text-primary underline"
                        >
                          {driverDisplayName(row.driver)}
                        </Link>
                        <p className="text-xs text-muted-foreground">{humanize(row.payMethod)}</p>
                      </td>
                      <td className="py-2.5 pr-3">
                        {row.load ? (
                          <Link href={`/loads/${row.load.id}`} className="underline">
                            {row.load.loadNumber}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2.5 pr-3">{formatMoney(row.payCents)}</td>
                      <td className="py-2.5 pr-3 font-semibold">{formatMoney(row.netCents)}</td>
                      <td className="py-2.5 pr-3">
                        <span className="badge bg-slate-100 text-slate-700">{humanize(row.status)}</span>
                        {row.paidAt ? (
                          <p className="text-xs text-muted-foreground">Paid {formatDate(row.paidAt)}</p>
                        ) : null}
                      </td>
                      <td className="py-2.5">
                        <div className="flex flex-col gap-1">
                          {row.status === "DRAFT" ? (
                            <form action={updateDriverSettlementStatus}>
                              <input type="hidden" name="settlementId" value={row.id} />
                              <input type="hidden" name="status" value="APPROVED" />
                              <button type="submit" className="text-xs font-semibold text-primary underline">
                                Approve
                              </button>
                            </form>
                          ) : null}
                          {row.status === "APPROVED" ? (
                            <form action={updateDriverSettlementStatus}>
                              <input type="hidden" name="settlementId" value={row.id} />
                              <input type="hidden" name="status" value="PAID" />
                              <button type="submit" className="text-xs font-semibold text-emerald-700 underline">
                                Mark paid
                              </button>
                            </form>
                          ) : null}
                          {row.status !== "VOID" && row.status !== "PAID" ? (
                            <form action={updateDriverSettlementStatus}>
                              <input type="hidden" name="settlementId" value={row.id} />
                              <input type="hidden" name="status" value="VOID" />
                              <button type="submit" className="text-xs font-semibold text-rose-700 underline">
                                Void
                              </button>
                            </form>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="mb-4 text-lg font-semibold">Create settlement</h2>
          <form action={createDriverSettlement} className="grid gap-3">
            <label className="grid gap-1">
              <span className="label">Driver</span>
              <select className="input" name="driverId" required defaultValue="">
                <option value="" disabled>
                  Select driver
                </option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {driverDisplayName(d)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="label">Load (optional)</span>
              <select className="input" name="loadId" defaultValue="">
                <option value="">None</option>
                {loads.map((load) => (
                  <option key={load.id} value={load.id}>
                    {load.loadNumber} · {formatMoney(load.revenueCents)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="label">Pay method</span>
              <select className="input" name="payMethod" defaultValue="FLAT">
                <option value="FLAT">Flat</option>
                <option value="PER_MILE">Per mile</option>
                <option value="PERCENT_REVENUE">Percent of revenue</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="label">Miles</span>
                <input className="input" name="miles" type="number" step="0.1" defaultValue="0" />
              </label>
              <label className="grid gap-1">
                <span className="label">Load revenue (USD)</span>
                <input className="input" name="revenue" type="number" step="0.01" defaultValue="0" />
              </label>
              <label className="grid gap-1">
                <span className="label">Gross pay (USD)</span>
                <input className="input" name="pay" type="number" step="0.01" required />
              </label>
              <label className="grid gap-1">
                <span className="label">Deductions (USD)</span>
                <input className="input" name="deductions" type="number" step="0.01" defaultValue="0" />
              </label>
              <label className="grid gap-1">
                <span className="label">Period start</span>
                <input className="input" name="periodStart" type="date" />
              </label>
              <label className="grid gap-1">
                <span className="label">Period end</span>
                <input className="input" name="periodEnd" type="date" />
              </label>
            </div>
            <label className="grid gap-1">
              <span className="label">Notes</span>
              <textarea className="input min-h-[70px]" name="notes" />
            </label>
            <button className="btn" type="submit">
              Create draft
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
