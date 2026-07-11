import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireTmsAccess } from "@/lib/permissions";
import { branchScopedWhere } from "@/lib/scope";
import { prisma } from "@/lib/db";
import { formatDate, formatMoney, marginPercent } from "@/lib/format";
import { syncMissingCommissions } from "@/lib/commission";

export default async function LoadsPage() {
  const user = await requireTmsAccess();
  await syncMissingCommissions(user.companyId);
  const loads = await prisma.load.findMany({
    where: branchScopedWhere(user),
    orderBy: [{ pickupDate: "asc" }, { loadNumber: "asc" }],
    include: {
      customer: true,
      dispatchAssignment: { include: { carrier: true } },
      commission: true
    }
  });

  return (
    <>
      <PageHeader
        title="Load Management"
        description="Create, search, cover, dispatch, and track customer loads through the full brokerage lifecycle."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/search" className="btn-secondary">
              Advanced Search
            </Link>
            <Link href="/loads/new" className="btn">
              New Load
            </Link>
          </div>
        }
      />

      <section className="card overflow-hidden p-0">
        <div className="border-b border-border p-5">
          <h2 className="section-title">All Loads</h2>
          <p className="muted">The board is sorted by the next pickup date.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Load</th>
                <th>Status</th>
                <th>Customer</th>
                <th>Lane</th>
                <th>Pickup</th>
                <th>Equipment</th>
                <th>Commodity</th>
                <th>Carrier</th>
                <th>Financials</th>
              </tr>
            </thead>
            <tbody>
              {loads.map((load) => (
                <tr key={load.id}>
                  <td>
                    <Link href={`/loads/${load.id}`} className="font-semibold text-primary">
                      {load.loadNumber}
                    </Link>
                    <p className="muted">{load.title}</p>
                  </td>
                  <td>
                    <StatusBadge value={load.status} />
                  </td>
                  <td>{load.customer.name}</td>
                  <td>
                    {load.pickupCity}, {load.pickupState} to {load.deliveryCity},{" "}
                    {load.deliveryState}
                  </td>
                  <td>{formatDate(load.pickupDate)}</td>
                  <td>{load.equipmentType}</td>
                  <td>{load.commodity ?? "General freight"}</td>
                  <td>{load.dispatchAssignment?.carrier.name ?? "Uncovered"}</td>
                  <td>
                    <p className="font-semibold">{formatMoney(load.revenueCents)}</p>
                    <p className="muted">
                      Margin {formatMoney(load.revenueCents - load.carrierCostCents)} (
                      {marginPercent(load.revenueCents, load.carrierCostCents)})
                    </p>
                    {load.commission ? (
                      <p className="mt-1 text-sm">
                        Commission {formatMoney(load.commission.branchShareCents)}{" "}
                        <StatusBadge value={load.commission.status} />
                      </p>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
