import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { DatePicker } from "@/components/ui/date-picker";
import { createAdvance, voidAdvance } from "@/lib/advance-actions";
import { advanceTypes } from "@/lib/constants";
import { driverDisplayName } from "@/lib/fleet-constants";
import { prisma } from "@/lib/db";
import { formatDate, formatMoney, humanize } from "@/lib/format";
import { requirePlanFeature } from "@/lib/permissions";
import { advanceRemainingCents } from "@/lib/driver-pay";

export default async function FleetAdvancesPage({
  searchParams
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const user = await requirePlanFeature("fleet_dispatch");
  const params = await searchParams;

  const [advances, drivers, carriers, loads] = await Promise.all([
    prisma.advance.findMany({
      where: { companyId: user.companyId },
      include: {
        driver: true,
        carrier: true,
        load: { select: { id: true, loadNumber: true } },
        applications: true
      },
      orderBy: { issuedAt: "desc" },
      take: 150
    }),
    prisma.driver.findMany({
      where: { companyId: user.companyId, status: { not: "TERMINATED" } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
    }),
    prisma.carrier.findMany({
      where: { companyId: user.companyId },
      orderBy: { name: "asc" }
    }),
    prisma.load.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: "desc" },
      take: 80,
      select: { id: true, loadNumber: true }
    })
  ]);

  return (
    <>
      <PageHeader
        title="Advances"
        description="Issue fuel or cash advances to drivers and carriers. Open advances deduct on settlements and carrier bills."
      />
      {params.saved ? (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          Advance saved.
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="card">
          <h2 className="mb-4 text-lg font-semibold">Recent advances</h2>
          {advances.length === 0 ? (
            <p className="muted">No advances yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-3">Payee</th>
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">Amount</th>
                    <th className="py-2 pr-3">Remaining</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {advances.map((row) => {
                    const remaining = advanceRemainingCents(row);
                    return (
                      <tr key={row.id} className="border-b border-border/60 align-top">
                        <td className="py-2.5 pr-3">
                          <div className="font-semibold">
                            {row.payeeType === "DRIVER" && row.driver
                              ? driverDisplayName(row.driver)
                              : row.carrier?.name ?? "—"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(row.issuedAt)}
                            {row.load ? ` · ${row.load.loadNumber}` : ""}
                            {row.reference ? ` · ${row.reference}` : ""}
                          </div>
                        </td>
                        <td className="py-2.5 pr-3">{humanize(row.advanceType)}</td>
                        <td className="py-2.5 pr-3">{formatMoney(row.amountCents)}</td>
                        <td className="py-2.5 pr-3">{formatMoney(remaining)}</td>
                        <td className="py-2.5 pr-3">{humanize(row.status)}</td>
                        <td className="py-2.5">
                          {row.status === "OPEN" && remaining === row.amountCents ? (
                            <form action={voidAdvance}>
                              <input type="hidden" name="advanceId" value={row.id} />
                              <button type="submit" className="btn-secondary text-xs">
                                Void
                              </button>
                            </form>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="mb-4 text-lg font-semibold">Issue advance</h2>
          <form action={createAdvance} className="grid gap-3">
            <label className="grid gap-1">
              <span className="label">Payee type</span>
              <select className="input" name="payeeType" defaultValue="DRIVER" required>
                <option value="DRIVER">Driver</option>
                <option value="CARRIER">Carrier</option>
              </select>
            </label>
            <label className="grid gap-1">
              <span className="label">Driver</span>
              <select className="input" name="driverId" defaultValue="">
                <option value="">Select driver</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driverDisplayName(driver)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="label">Carrier</span>
              <select className="input" name="carrierId" defaultValue="">
                <option value="">Select carrier</option>
                {carriers.map((carrier) => (
                  <option key={carrier.id} value={carrier.id}>
                    {carrier.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="label">Advance type</span>
              <select className="input" name="advanceType" defaultValue="CASH">
                {advanceTypes.map((type) => (
                  <option key={type} value={type}>
                    {humanize(type)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="label">Amount ($)</span>
              <input className="input" name="amount" required placeholder="0.00" />
            </label>
            <label className="grid gap-1">
              <span className="label">Issued</span>
              <DatePicker name="issuedAt" placeholder="Issue date" />
            </label>
            <label className="grid gap-1">
              <span className="label">Load (optional)</span>
              <select className="input" name="loadId" defaultValue="">
                <option value="">None</option>
                {loads.map((load) => (
                  <option key={load.id} value={load.id}>
                    {load.loadNumber}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="label">Reference</span>
              <input className="input" name="reference" placeholder="Check #, fuel card, etc." />
            </label>
            <label className="grid gap-1">
              <span className="label">Notes</span>
              <textarea className="input min-h-[70px]" name="notes" />
            </label>
            <button className="btn" type="submit">
              Issue advance
            </button>
          </form>
          <p className="muted mt-4 text-xs">
            <Link href="/fleet/settlements" className="font-semibold text-primary underline">
              Driver settlements
            </Link>{" "}
            apply open driver advances. Carrier advances deduct when creating or paying a carrier bill.
          </p>
        </div>
      </div>
    </>
  );
}
