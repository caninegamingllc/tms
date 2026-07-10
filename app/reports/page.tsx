import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { requireTmsAccess } from "@/lib/permissions";
import { branchScopedWhere } from "@/lib/scope";
import { prisma } from "@/lib/db";
import { formatDate, formatMoney, marginPercent } from "@/lib/format";

export default async function ReportsPage() {
  const user = await requireTmsAccess();
  const loadScope = branchScopedWhere(user);
  const customerScope = branchScopedWhere(user);
  const [loads, customers, carriers] = await Promise.all([
    prisma.load.findMany({
      where: loadScope,
      include: {
        customer: true,
        dispatchAssignment: { include: { carrier: true } },
        invoices: true,
        carrierBills: true
      },
      orderBy: { pickupDate: "desc" }
    }),
    prisma.customer.findMany({
      where: customerScope,
      include: { loads: true, invoices: true }
    }),
    prisma.carrier.findMany({
      where: { companyId: user.companyId },
      include: { assignments: { include: { load: true } } }
    })
  ]);

  const revenue = loads.reduce((sum, load) => sum + load.revenueCents, 0);
  const carrierCost = loads.reduce((sum, load) => sum + load.carrierCostCents, 0);
  const delivered = loads.filter((load) =>
    ["DELIVERED", "INVOICED", "PAID"].includes(load.status)
  ).length;
  const uncovered = loads.filter((load) => !load.dispatchAssignment).length;

  const laneCounts = loads.reduce<Record<string, { count: number; revenue: number }>>((acc, load) => {
    const lane = `${load.pickupState} to ${load.deliveryState}`;
    acc[lane] = acc[lane] ?? { count: 0, revenue: 0 };
    acc[lane].count += 1;
    acc[lane].revenue += load.revenueCents;
    return acc;
  }, {});

  const lanes = Object.entries(laneCounts).sort((a, b) => b[1].revenue - a[1].revenue);

  return (
    <>
      <PageHeader
        title="Reports"
        description="Review load profitability, customer volume, carrier performance, lane summaries, and operational exceptions."
      />

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Total Revenue" value={formatMoney(revenue)} detail="Booked customer revenue" />
        <MetricCard label="Gross Margin" value={formatMoney(revenue - carrierCost)} detail={marginPercent(revenue, carrierCost)} />
        <MetricCard label="Delivered Loads" value={delivered} detail={`${loads.length} loads total`} />
        <MetricCard label="Uncovered Loads" value={uncovered} detail="Needs carrier assignment" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="card overflow-hidden p-0">
          <div className="border-b border-border p-5">
            <h2 className="section-title">Load Profitability</h2>
            <p className="muted">Revenue, carrier cost, and margin by load.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Load</th>
                  <th>Customer</th>
                  <th>Pickup</th>
                  <th>Revenue</th>
                  <th>Cost</th>
                  <th>Margin</th>
                </tr>
              </thead>
              <tbody>
                {loads.map((load) => (
                  <tr key={load.id}>
                    <td className="font-semibold">{load.loadNumber}</td>
                    <td>{load.customer.name}</td>
                    <td>{formatDate(load.pickupDate)}</td>
                    <td>{formatMoney(load.revenueCents)}</td>
                    <td>{formatMoney(load.carrierCostCents)}</td>
                    <td>
                      {formatMoney(load.revenueCents - load.carrierCostCents)}
                      <p className="muted">{marginPercent(load.revenueCents, load.carrierCostCents)}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card overflow-hidden p-0">
          <div className="border-b border-border p-5">
            <h2 className="section-title">Lane Summary</h2>
            <p className="muted">Quick view of freight flow by state pair.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Lane</th>
                  <th>Loads</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {lanes.map(([lane, summary]) => (
                  <tr key={lane}>
                    <td className="font-semibold">{lane}</td>
                    <td>{summary.count}</td>
                    <td>{formatMoney(summary.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="card overflow-hidden p-0">
          <div className="border-b border-border p-5">
            <h2 className="section-title">Customer Volume</h2>
            <p className="muted">Load counts and AR by customer.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Loads</th>
                  <th>Open AR</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => {
                  const openAr = customer.invoices
                    .filter((invoice) => invoice.status !== "PAID" && invoice.status !== "VOID")
                    .reduce((sum, invoice) => sum + invoice.totalCents, 0);
                  return (
                    <tr key={customer.id}>
                      <td className="font-semibold">{customer.name}</td>
                      <td>{customer.loads.length}</td>
                      <td>{formatMoney(openAr)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card overflow-hidden p-0">
          <div className="border-b border-border p-5">
            <h2 className="section-title">Carrier Performance</h2>
            <p className="muted">Carrier load counts and spend.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Carrier</th>
                  <th>Loads</th>
                  <th>Total Spend</th>
                </tr>
              </thead>
              <tbody>
                {carriers.map((carrier) => (
                  <tr key={carrier.id}>
                    <td className="font-semibold">{carrier.name}</td>
                    <td>{carrier.assignments.length}</td>
                    <td>
                      {formatMoney(
                        carrier.assignments.reduce((sum, assignment) => sum + assignment.rateCents, 0)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
