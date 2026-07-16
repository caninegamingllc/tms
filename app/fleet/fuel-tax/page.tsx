import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { createIftaQuarter } from "@/lib/ifta-actions";
import { prisma } from "@/lib/db";
import { formatDate, humanize } from "@/lib/format";
import { requirePlanFeature } from "@/lib/permissions";

export default async function FleetFuelTaxPage({
  searchParams
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const user = await requirePlanFeature("fuel_tax_ifta");
  const params = await searchParams;
  const now = new Date();
  const defaultYear = now.getFullYear();
  const defaultQuarter = Math.floor(now.getMonth() / 3) + 1;

  const quarters = await prisma.iftaQuarter.findMany({
    where: { companyId: user.companyId },
    include: {
      _count: { select: { trips: true, fuelPurchases: true } }
    },
    orderBy: [{ year: "desc" }, { quarter: "desc" }]
  });

  return (
    <>
      <PageHeader
        title="Fuel tax (IFTA)"
        description="Open a quarter, enter jurisdiction miles and fuel purchases, then export a worksheet for filing."
      />
      {params.saved ? (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          Saved.
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="card">
          <h2 className="mb-4 text-lg font-semibold">Quarters</h2>
          {quarters.length === 0 ? (
            <p className="muted">No quarters yet. Open one on the right.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3">Period</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Trips</th>
                    <th className="py-2 pr-3">Fuel</th>
                    <th className="py-2">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {quarters.map((q) => (
                    <tr key={q.id} className="border-b border-border/60">
                      <td className="py-2.5 pr-3">
                        <Link
                          href={`/fleet/fuel-tax/${q.id}`}
                          className="font-semibold text-primary underline"
                        >
                          Q{q.quarter} {q.year}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className="badge bg-slate-100 text-slate-700">{humanize(q.status)}</span>
                      </td>
                      <td className="py-2.5 pr-3">{q._count.trips}</td>
                      <td className="py-2.5 pr-3">{q._count.fuelPurchases}</td>
                      <td className="py-2.5">{formatDate(q.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="mb-4 text-lg font-semibold">Open quarter</h2>
          <form action={createIftaQuarter} className="grid gap-3">
            <label className="grid gap-1">
              <span className="label">Year</span>
              <input className="input" name="year" type="number" defaultValue={defaultYear} required />
            </label>
            <label className="grid gap-1">
              <span className="label">Quarter</span>
              <select className="input" name="quarter" defaultValue={String(defaultQuarter)}>
                <option value="1">Q1 (Jan–Mar)</option>
                <option value="2">Q2 (Apr–Jun)</option>
                <option value="3">Q3 (Jul–Sep)</option>
                <option value="4">Q4 (Oct–Dec)</option>
              </select>
            </label>
            <label className="grid gap-1">
              <span className="label">Notes</span>
              <textarea className="input min-h-[70px]" name="notes" />
            </label>
            <button className="btn" type="submit">
              Create quarter
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
