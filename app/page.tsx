import Link from "next/link";
import { AlertCircle, Banknote, ClipboardList, Truck } from "lucide-react";
import { FuelIndexCard } from "@/components/fuel-index-card";
import { LoadSnapshotTable } from "@/components/load-snapshot-table";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { getDieselPrices } from "@/lib/eia-diesel";
import { formatDateTime, formatMoney } from "@/lib/format";
import { getDashboardData } from "@/lib/queries";

export default async function DashboardPage() {
  const [data, dieselPrices] = await Promise.all([getDashboardData(), getDieselPrices()]);

  return (
    <>
      <PageHeader
        title="Command center"
        description="Live pulse across loads, margin, AR, and check calls."
        eyebrow="Operations"
        action={
          <Link href="/loads/new" className="btn">
            Create Load
          </Link>
        }
      />

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

      <div className="mt-4">
        <FuelIndexCard data={dieselPrices} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <section className="card overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-3 md:px-5">
            <div>
              <h2 className="section-title">Load board snapshot</h2>
              <p className="muted">Most recent freight, coverage, and margin.</p>
            </div>
            <Link href="/loads" className="btn-secondary">
              View All
            </Link>
          </div>
          <div className="overflow-x-auto">
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
        </section>

        <section className="card !p-4">
          <h2 className="section-title">Recent check calls</h2>
          <p className="muted">Latest driver and carrier updates.</p>
          <div className="mt-3 grid gap-2">
            {data.checkCalls.map((call) => (
              <div key={call.id} className="rounded-md border border-border bg-muted/40 px-3 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-semibold text-foreground">
                      {call.assignment.load.loadNumber}
                    </p>
                    <p className="text-[12px] text-muted-foreground">{call.assignment.carrier.name}</p>
                  </div>
                  <span className="text-[11px] text-muted-foreground tabular">
                    {formatDateTime(call.occurredAt)}
                  </span>
                </div>
                <p className="mt-1.5 text-[13px] font-semibold text-foreground">{call.status}</p>
                <p className="text-[12px] text-muted-foreground">{call.location}</p>
                {call.notes ? <p className="mt-1 text-[12px] text-slate-600">{call.notes}</p> : null}
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
