import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { DatePicker } from "@/components/ui/date-picker";
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
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const user = await requirePlanFeature("fleet_dispatch");
  const params = await searchParams;

  const [settlements, drivers] = await Promise.all([
    prisma.driverSettlement.findMany({
      where: { companyId: user.companyId },
      include: {
        driver: true,
        items: { orderBy: { sortOrder: "asc" } },
        load: { select: { id: true, loadNumber: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    }),
    prisma.driver.findMany({
      where: { companyId: user.companyId, status: { not: "TERMINATED" } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
    })
  ]);

  return (
    <>
      <PageHeader
        title="Driver settlements"
        description="Build a period settlement from unsettled load pay and open advances, then approve and mark paid."
      />
      {params.saved ? (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          Settlement saved.
        </div>
      ) : null}
      {params.error ? (
        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
          {params.error}
        </div>
      ) : null}

      <div className="mb-4 text-sm">
        <Link href="/fleet/advances" className="font-semibold text-primary underline">
          Manage advances
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="card">
          <h2 className="mb-4 text-lg font-semibold">Settlements</h2>
          {settlements.length === 0 ? (
            <p className="muted">No settlements yet.</p>
          ) : (
            <div className="space-y-4">
              {settlements.map((row) => (
                <div key={row.id} className="rounded-2xl border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <Link
                        href={`/fleet/drivers/${row.driverId}`}
                        className="font-semibold text-primary underline"
                      >
                        {driverDisplayName(row.driver)}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {row.periodStart && row.periodEnd
                          ? `${formatDate(row.periodStart)} – ${formatDate(row.periodEnd)}`
                          : row.load
                            ? `Load ${row.load.loadNumber}`
                            : "No period"}
                        {" · "}
                        {humanize(row.payMethod)} · {humanize(row.status)}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <div>Pay {formatMoney(row.payCents)}</div>
                      <div className="text-muted-foreground">
                        Deductions {formatMoney(row.deductionsCents)}
                      </div>
                      <div className="font-semibold">Net {formatMoney(row.netCents)}</div>
                    </div>
                  </div>
                  {row.items.length > 0 ? (
                    <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                      {row.items.slice(0, 8).map((item) => (
                        <li key={item.id} className="flex justify-between gap-3">
                          <span>{item.label}</span>
                          <span>{formatMoney(item.amountCents)}</span>
                        </li>
                      ))}
                      {row.items.length > 8 ? (
                        <li>+{row.items.length - 8} more lines</li>
                      ) : null}
                    </ul>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {row.status === "DRAFT" ? (
                      <>
                        <form action={updateDriverSettlementStatus}>
                          <input type="hidden" name="settlementId" value={row.id} />
                          <input type="hidden" name="status" value="APPROVED" />
                          <button className="btn-secondary text-xs" type="submit">
                            Approve
                          </button>
                        </form>
                        <form action={updateDriverSettlementStatus}>
                          <input type="hidden" name="settlementId" value={row.id} />
                          <input type="hidden" name="status" value="VOID" />
                          <button className="btn-secondary text-xs" type="submit">
                            Void
                          </button>
                        </form>
                      </>
                    ) : null}
                    {row.status === "APPROVED" ? (
                      <>
                        <form action={updateDriverSettlementStatus}>
                          <input type="hidden" name="settlementId" value={row.id} />
                          <input type="hidden" name="status" value="PAID" />
                          <button className="btn text-xs" type="submit">
                            Mark paid
                          </button>
                        </form>
                        <form action={updateDriverSettlementStatus}>
                          <input type="hidden" name="settlementId" value={row.id} />
                          <input type="hidden" name="status" value="VOID" />
                          <button className="btn-secondary text-xs" type="submit">
                            Void
                          </button>
                        </form>
                      </>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="mb-2 text-lg font-semibold">Build period settlement</h2>
          <p className="muted mb-4 text-sm">
            Pulls unsettled driver pay lines on loads delivered in the period, plus open advances,
            into a draft settlement.
          </p>
          <form action={createDriverSettlement} className="grid gap-3">
            <label className="grid gap-1">
              <span className="label">Driver</span>
              <select className="input" name="driverId" required defaultValue="">
                <option value="">Select driver</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driverDisplayName(driver)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="label">Period start</span>
              <DatePicker name="periodStart" required placeholder="Start" />
            </label>
            <label className="grid gap-1">
              <span className="label">Period end</span>
              <DatePicker name="periodEnd" required placeholder="End" />
            </label>
            <label className="grid gap-1">
              <span className="label">Notes</span>
              <textarea className="input min-h-[70px]" name="notes" />
            </label>
            <button className="btn" type="submit">
              Build settlement
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
