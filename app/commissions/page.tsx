import Link from "next/link";
import { CommissionFilters } from "@/components/commission-filters";
import { CommissionSettleTable } from "@/components/commission-settle-table";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { syncMissingCommissions } from "@/lib/commission";
import { buildCommissionWhere, parseCommissionSearchParams } from "@/lib/commission-search";
import { requireTmsAccess } from "@/lib/permissions";
import { canManageUsers, canSeeAllBranches, canSettleCommission } from "@/lib/scope";
import { prisma } from "@/lib/db";
import { commissionMethodLabel, formatDate, formatMoney, humanize } from "@/lib/format";

export default async function CommissionsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireTmsAccess();
  const params = await searchParams;
  const filters = parseCommissionSearchParams(params);

  await syncMissingCommissions(user.companyId);

  const where = buildCommissionWhere(user, filters);

  const [commissions, branches] = await Promise.all([
    prisma.loadCommission.findMany({
      where,
      orderBy: [{ load: { pickupDate: "desc" } }, { load: { loadNumber: "desc" } }],
      include: {
        branch: true,
        load: {
          include: {
            customer: true,
            invoices: { orderBy: { paidAt: "desc" }, take: 1 }
          }
        }
      }
    }),
    canSeeAllBranches(user)
      ? prisma.branch.findMany({
          where: { companyId: user.companyId },
          orderBy: { name: "asc" }
        })
      : Promise.resolve([])
  ]);

  const totalPayable = commissions
    .filter((commission) => commission.status === "PAYABLE")
    .reduce((sum, commission) => sum + commission.branchShareCents, 0);
  const totalSettled = commissions
    .filter((commission) => commission.status === "SETTLED")
    .reduce((sum, commission) => sum + commission.branchShareCents, 0);
  const pendingCount = commissions.filter((commission) => commission.status === "PENDING").length;

  const rows = commissions.map((commission) => {
    const paidInvoice = commission.load.invoices.find((invoice) => invoice.paidAt);
    const customerPaidAt = paidInvoice?.paidAt ?? (commission.load.status === "PAID" ? commission.payableAt : null);

    return {
      id: commission.id,
      loadId: commission.loadId,
      loadNumber: commission.load.loadNumber,
      branchName: commission.branch?.name ?? "Unassigned",
      customerName: commission.load.customer.name,
      lane: `${commission.load.pickupCity}, ${commission.load.pickupState} to ${commission.load.deliveryCity}, ${commission.load.deliveryState}`,
      pickupDate: formatDate(commission.load.pickupDate),
      pickupDateRaw: commission.load.pickupDate.toISOString(),
      revenue: formatMoney(commission.revenueCents),
      revenueCents: commission.revenueCents,
      grossExpenses: formatMoney(commission.grossExpenseCents),
      grossProfit: formatMoney(commission.grossProfitCents),
      grossProfitCents: commission.grossProfitCents,
      commissionable: commission.isCommissionable,
      profileName: commission.profileName,
      branchCommission: formatMoney(commission.branchShareCents),
      branchCommissionCents: commission.branchShareCents,
      companyShare: formatMoney(commission.companyShareCents),
      calculationMethod: commissionMethodLabel(commission.calculationMethod),
      status: humanize(commission.status),
      customerPaidAt: customerPaidAt ? formatDate(customerPaidAt) : "—",
      canSettle: commission.status === "PAYABLE"
    };
  });

  return (
    <>
      <PageHeader
        title="Commissions"
        description="Track branch commission calculations, payable amounts, and settlement status by load."
        action={
          canManageUsers(user) ? (
            <Link href="/commissions/profiles" className="btn-secondary">
              Commission Profiles
            </Link>
          ) : undefined
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Payable to Branches" value={formatMoney(totalPayable)} detail="Customer-paid, awaiting settlement" />
        <MetricCard label="Settled" value={formatMoney(totalSettled)} detail="Branch commissions paid out" />
        <MetricCard label="Pending Loads" value={String(pendingCount)} detail="Awaiting customer payment" />
      </div>

      <div className="mt-6 grid gap-6">
        <CommissionFilters filters={filters} branches={branches} />
        <CommissionSettleTable rows={rows} canSettle={canSettleCommission(user)} />
      </div>
    </>
  );
}
