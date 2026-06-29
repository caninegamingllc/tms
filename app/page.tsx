import Link from "next/link";
import { AlertCircle, Banknote, ClipboardList, Truck } from "lucide-react";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { formatDate, formatDateTime, formatMoney, marginPercent } from "@/lib/format";
import { getDashboardData } from "@/lib/queries";

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <>
      <PageHeader
        title="Operations Dashboard"
        description="Monitor active loads, margin, customer billing, carrier payables, and recent check calls from one brokerage command center."
        action={
          <Link href="/loads/new" className="btn">
            Create Load
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Active Loads"
          value={data.activeLoads.length}
          detail={`${data.loads.length} total loads in the system`}
          icon={<ClipboardList className="h-5 w-5" />}
        />
        <MetricCard
          label="Booked Revenue"
          value={formatMoney(data.revenueCents)}
          detail={`Margin ${formatMoney(data.marginCents)} across visible loads`}
          icon={<Banknote className="h-5 w-5" />}
        />
        <MetricCard
          label="Open AR"
          value={formatMoney(data.openArCents)}
          detail="Customer invoices not yet paid"
          icon={<AlertCircle className="h-5 w-5" />}
        />
        <MetricCard
          label="Carrier Network"
          value={data.carriers}
          detail={`${data.customers} active customer accounts`}
          icon={<Truck className="h-5 w-5" />}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="card overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-border p-5">
            <div>
              <h2 className="section-title">Load Board Snapshot</h2>
              <p className="muted">Upcoming freight, coverage, and margin.</p>
            </div>
            <Link href="/loads" className="btn-secondary">
              View All
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Load</th>
                  <th>Customer</th>
                  <th>Lane</th>
                  <th>Pickup</th>
                  <th>Status</th>
                  <th>Margin</th>
                </tr>
              </thead>
              <tbody>
                {data.loads.map((load) => (
                  <tr key={load.id}>
                    <td>
                      <Link href={`/loads/${load.id}`} className="font-semibold text-brand-700">
                        {load.loadNumber}
                      </Link>
                      <p className="muted">{load.equipmentType}</p>
                    </td>
                    <td>{load.customer.name}</td>
                    <td>
                      {load.pickupCity}, {load.pickupState} to {load.deliveryCity},{" "}
                      {load.deliveryState}
                    </td>
                    <td>{formatDate(load.pickupDate)}</td>
                    <td>
                      <StatusBadge value={load.status} />
                    </td>
                    <td>
                      <span className="font-semibold">
                        {formatMoney(load.revenueCents - load.carrierCostCents)}
                      </span>
                      <p className="muted">{marginPercent(load.revenueCents, load.carrierCostCents)}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <h2 className="section-title">Recent Check Calls</h2>
          <p className="muted">Latest driver and carrier updates.</p>
          <div className="mt-4 grid gap-3">
            {data.checkCalls.map((call) => (
              <div key={call.id} className="rounded-2xl border border-border bg-soft p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{call.assignment.load.loadNumber}</p>
                    <p className="muted">{call.assignment.carrier.name}</p>
                  </div>
                  <span className="text-xs text-muted">{formatDateTime(call.occurredAt)}</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-ink">{call.status}</p>
                <p className="text-sm text-muted">{call.location}</p>
                {call.notes ? <p className="mt-2 text-sm text-slate-600">{call.notes}</p> : null}
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
