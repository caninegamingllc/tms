import Link from "next/link";
import { LoadsTable } from "@/components/loads-table";
import { PageHeader } from "@/components/page-header";
import { requireTmsAccess } from "@/lib/permissions";
import { branchScopedWhere } from "@/lib/scope";
import { prisma } from "@/lib/db";
import { syncMissingCommissions } from "@/lib/commission";

export default async function LoadsPage() {
  const user = await requireTmsAccess();
  await syncMissingCommissions(user.companyId);
  const loads = await prisma.load.findMany({
    where: branchScopedWhere(user),
    orderBy: [{ pickupDate: "desc" }, { loadNumber: "desc" }],
    include: {
      customer: true,
      dispatchAssignment: { include: { carrier: true } },
      commission: true
    }
  });

  const rows = loads.map((load) => ({
    id: load.id,
    loadNumber: load.loadNumber,
    title: load.title,
    status: load.status,
    customerName: load.customer.name,
    pickupCity: load.pickupCity,
    pickupState: load.pickupState,
    deliveryCity: load.deliveryCity,
    deliveryState: load.deliveryState,
    pickupDate: load.pickupDate.toISOString(),
    equipmentType: load.equipmentType,
    commodity: load.commodity,
    carrierName: load.dispatchAssignment?.carrier.name ?? "Uncovered",
    revenueCents: load.revenueCents,
    carrierCostCents: load.carrierCostCents,
    commission: load.commission
      ? {
          branchShareCents: load.commission.branchShareCents,
          status: load.commission.status
        }
      : null
  }));

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
          <p className="muted">Click any column header to sort. Most recent pickups shown first.</p>
        </div>
        <div className="overflow-x-auto">
          <LoadsTable loads={rows} />
        </div>
      </section>
    </>
  );
}
