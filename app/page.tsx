import Link from "next/link";
import { AlertCircle, Banknote, ClipboardList, Truck } from "lucide-react";
import { FuelIndexCard } from "@/components/fuel-index-card";
import { LoadSnapshotTable } from "@/components/load-snapshot-table";
import { MarketingLanding } from "@/components/marketing-landing";
import { MetricCard } from "@/components/metric-card";
import { DashboardWelcome } from "@/components/dashboard-welcome";
import { TileBoard, Tile } from "@/components/tile-board";
import { getCurrentUser } from "@/lib/auth";
import { getDieselPrices } from "@/lib/eia-diesel";
import { formatDateTime, formatMoney } from "@/lib/format";
import { planHasFeature } from "@/lib/plans";
import { requireTmsAccess } from "@/lib/permissions";
import { getDashboardData } from "@/lib/queries";
import { DASHBOARD_TILES } from "@/lib/tile-defaults";
import { loadPageLayouts } from "@/lib/ui-preferences-load";

export default async function HomePage({
  searchParams
}: {
  searchParams: Promise<{ welcome?: string; error?: string }>;
}) {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) {
    return <MarketingLanding />;
  }

  const user = await requireTmsAccess();
  const params = await searchParams;
  const showFuel = planHasFeature(user.plan, "dashboard_fuel_index");
  const firstName = user.name.trim().split(/\s+/)[0] || user.name;

  const [data, dieselPrices, layouts] = await Promise.all([
    getDashboardData(),
    showFuel ? getDieselPrices() : Promise.resolve(null),
    loadPageLayouts("dashboard")
  ]);

  const tiles = showFuel
    ? DASHBOARD_TILES
    : DASHBOARD_TILES.filter((tile) => tile.id !== "fuel-index");

  return (
    <div className="bg-app-mesh -mx-4 -mb-4 min-h-[calc(100vh-3.5rem)] px-4 py-6 md:-mx-6 md:-mb-5 md:px-6 md:py-8">
      <DashboardWelcome
        firstName={firstName}
        organizationName={user.companyName}
        tourId="dashboard-welcome"
        action={
          <Link href="/loads/new" className="btn">
            Create Load
          </Link>
        }
      />

      {params.welcome === "1" ? (
        <div className="card mb-6 border-primary/20 bg-lightprimary text-sm text-primary">
          Welcome! You are on the Free plan with one seat.{" "}
          <Link href="/admin/billing" className="font-semibold underline">
            Upgrade in Billing
          </Link>{" "}
          for documents, accounting, and team seats.
        </div>
      ) : null}

      {params.error ? (
        <div className="card mb-6 border-rose-200 bg-rose-50 text-sm font-semibold text-rose-700">
          {params.error}
        </div>
      ) : null}

      <TileBoard pageId="dashboard" tiles={tiles} initialLayouts={layouts}>
        <Tile id="metrics">
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="grid md:grid-cols-2 xl:grid-cols-4 xl:[&>*:nth-child(4n)]:border-r-0">
              <MetricCard
                label="Active Loads"
                value={data.activeLoads.length}
                detail={`${data.loads.length} total loads in the system`}
                icon={<ClipboardList className="h-4 w-4" />}
              />
              <MetricCard
                label="Booked Revenue"
                value={formatMoney(data.revenueCents)}
                detail={`Margin ${formatMoney(data.marginCents)} across visible loads`}
                icon={<Banknote className="h-4 w-4" />}
              />
              <MetricCard
                label="Open AR"
                value={formatMoney(data.openArCents)}
                detail="Customer invoices not yet paid"
                icon={<AlertCircle className="h-4 w-4" />}
              />
              <MetricCard
                label="Carrier Network"
                value={data.carriers}
                detail={`${data.customers} active customer accounts`}
                icon={<Truck className="h-4 w-4" />}
              />
            </div>
          </div>
        </Tile>

        {showFuel && dieselPrices ? (
          <Tile id="fuel-index">
            <FuelIndexCard data={dieselPrices} />
          </Tile>
        ) : null}

        <Tile id="load-board">
          <div className="flex items-center justify-between gap-3">
            <p className="muted">Most recent freight, coverage, and margin.</p>
            <Link href="/loads" className="btn-secondary">
              View All
            </Link>
          </div>
          <div className="mt-3 overflow-x-auto">
            <LoadSnapshotTable
              loads={data.loads.map((load) => ({
                id: load.id,
                loadNumber: load.loadNumber,
                equipmentType: load.equipmentType,
                customerName: load.customer.name,
                pickupCity: load.pickupCity,
                pickupState: load.pickupState,
                deliveryCity: load.deliveryCity,
                deliveryState: load.deliveryState,
                pickupDate: load.pickupDate.toISOString(),
                status: load.status,
                revenueCents: load.revenueCents,
                carrierCostCents: load.carrierCostCents
              }))}
            />
          </div>
        </Tile>

        <Tile id="check-calls">
          <p className="muted">Recent updates and scheduled next check calls.</p>
          <div className="mt-3 grid gap-2">
            {data.checkCalls.map((call) => {
              const isNextCheck = call.dashboardKind === "next";
              const carrierLabel =
                call.assignment.carrier?.name ?? call.assignment.driverName ?? "Fleet / uncovered";

              return (
                <Link
                  key={`${call.dashboardKind}-${call.id}`}
                  href={`/loads/${call.assignment.load.id}`}
                  className={
                    isNextCheck
                      ? "rounded-md border border-primary/30 bg-lightprimary/60 px-3 py-2.5 transition hover:bg-lightprimary"
                      : "rounded-md border border-border bg-muted/40 px-3 py-2.5 transition hover:bg-muted"
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[13px] font-semibold text-foreground">
                          {call.assignment.load.loadNumber}
                        </p>
                        <span
                          className={
                            isNextCheck
                              ? "rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-primary"
                              : "rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-600"
                          }
                        >
                          {isNextCheck ? "Next check" : "Check call"}
                        </span>
                      </div>
                      <p className="text-[12px] text-muted-foreground">{carrierLabel}</p>
                    </div>
                    <span className="text-[11px] text-muted-foreground tabular">
                      {formatDateTime(call.dashboardAt)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[13px] font-semibold text-foreground">
                    {isNextCheck
                      ? call.nextCheckNotes ?? "Scheduled check call"
                      : call.notes ?? "Check call"}
                  </p>
                  <p className="text-[12px] text-muted-foreground">
                    {isNextCheck ? `Last check: ${call.location}` : call.location}
                  </p>
                </Link>
              );
            })}
            {data.checkCalls.length === 0 ? (
              <p className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                No check calls yet.
              </p>
            ) : null}
          </div>
        </Tile>
      </TileBoard>
    </div>
  );
}
