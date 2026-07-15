import Link from "next/link";
import { after } from "next/server";
import { CommissionFilters } from "@/components/commission-filters";
import { CommissionSettleTable } from "@/components/commission-settle-table";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { TileBoard, Tile } from "@/components/tile-board";
import { syncMissingCommissions, syncStalePayableCommissions } from "@/lib/commission";
import { getBranchScope } from "@/lib/branch-filter-server";
import { buildCommissionWhere, parseCommissionSearchParams } from "@/lib/commission-search";
import { requireTmsAccess } from "@/lib/permissions";
import { canManageUsers, canSettleCommission } from "@/lib/scope";
import { prisma } from "@/lib/db";
import { commissionMethodLabel, formatDate, formatMoney, humanize } from "@/lib/format";
import { COMMISSIONS_TILES } from "@/lib/tile-defaults";
import { loadPageLayouts } from "@/lib/ui-preferences-load";

export default async function CommissionsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireTmsAccess();
  const params = await searchParams;
  const filters = parseCommissionSearchParams(params);

  after(() => {
    void syncMissingCommissions(user.companyId).then(() =>
      syncStalePayableCommissions(user.companyId)
    );
  });

  const loadScope = await getBranchScope(user);
  const where = buildCommissionWhere(loadScope, filters);
  const manageProfiles = canManageUsers(user);

  const [commissions, profileCount, layouts] = await Promise.all([
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
    manageProfiles
      ? prisma.commissionProfile.count({ where: { companyId: user.companyId } })
      : Promise.resolve(0),
    loadPageLayouts("commissions")
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

  const tiles = manageProfiles
    ? COMMISSIONS_TILES
    : COMMISSIONS_TILES.filter((tile) => tile.id !== "profiles-cta");

  return (
    <>
      <PageHeader
        title="Commissions"
        description="Track branch commission calculations, payable amounts, and settlement status by load."
        action={
          manageProfiles ? (
            <Link href="/commissions/profiles" className="btn-secondary">
              Commission Profiles
            </Link>
          ) : undefined
        }
      />

      <TileBoard pageId="commissions" tiles={tiles} initialLayouts={layouts}>
        <Tile id="metrics">
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="grid md:grid-cols-3 md:[&>*:nth-child(3n)]:border-r-0">
              <MetricCard
                label="Payable to Branches"
                value={formatMoney(totalPayable)}
                detail="Customer-paid, awaiting settlement"
              />
              <MetricCard
                label="Settled"
                value={formatMoney(totalSettled)}
                detail="Branch commissions paid out"
              />
              <MetricCard
                label="Pending Loads"
                value={String(pendingCount)}
                detail="Awaiting customer payment"
              />
            </div>
          </div>
        </Tile>

        {manageProfiles ? (
          <Tile id="profiles-cta">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <p className="muted">
                {profileCount} profile{profileCount === 1 ? "" : "s"} configured. Create rules for branch
                and company splits, then assign defaults to branches or individual loads.
              </p>
              <Link href="/commissions/profiles" className="btn">
                Manage Profiles
              </Link>
            </div>
          </Tile>
        ) : null}

        <Tile id="filters">
          <CommissionFilters filters={filters} />
        </Tile>

        <Tile id="settlement">
          <CommissionSettleTable rows={rows} canSettle={canSettleCommission(user)} />
        </Tile>
      </TileBoard>
    </>
  );
}
