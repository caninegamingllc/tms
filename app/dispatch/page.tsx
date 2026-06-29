import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { addCheckCall } from "@/lib/actions";
import { prisma } from "@/lib/db";
import { formatDateTime, formatMoney } from "@/lib/format";

export default async function DispatchPage() {
  const assignments = await prisma.dispatchAssignment.findMany({
    orderBy: { assignedAt: "desc" },
    include: {
      carrier: true,
      load: { include: { customer: true } },
      checkCalls: { orderBy: { occurredAt: "desc" }, take: 3 }
    }
  });

  const uncoveredLoads = await prisma.load.findMany({
    where: { dispatchAssignment: null, status: { in: ["AVAILABLE", "COVERED", "QUOTE"] } },
    include: { customer: true },
    orderBy: { pickupDate: "asc" }
  });

  return (
    <>
      <PageHeader
        title="Dispatch"
        description="Track covered loads, driver details, check calls, and uncovered freight that still needs carrier sales."
      />

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.8fr]">
        <section className="grid gap-4">
          {assignments.map((assignment) => (
            <article key={assignment.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <Link href={`/loads/${assignment.load.id}`} className="text-xl font-bold text-brand-700">
                    {assignment.load.loadNumber}
                  </Link>
                  <p className="muted">
                    {assignment.load.customer.name} - {assignment.load.pickupCity},{" "}
                    {assignment.load.pickupState} to {assignment.load.deliveryCity},{" "}
                    {assignment.load.deliveryState}
                  </p>
                </div>
                <StatusBadge value={assignment.load.status} />
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl bg-soft p-3">
                  <p className="label">Carrier</p>
                  <p className="font-semibold">{assignment.carrier.name}</p>
                </div>
                <div className="rounded-2xl bg-soft p-3">
                  <p className="label">Driver</p>
                  <p className="font-semibold">{assignment.driverName ?? "TBD"}</p>
                  <p className="muted">{assignment.driverPhone ?? "No phone"}</p>
                </div>
                <div className="rounded-2xl bg-soft p-3">
                  <p className="label">Equipment</p>
                  <p className="font-semibold">
                    {assignment.truckNumber ?? "Truck TBD"} / {assignment.trailerNumber ?? "Trailer TBD"}
                  </p>
                </div>
                <div className="rounded-2xl bg-soft p-3">
                  <p className="label">Rate</p>
                  <p className="font-semibold">{formatMoney(assignment.rateCents)}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
                <div>
                  <h3 className="text-sm font-semibold text-ink">Latest Check Calls</h3>
                  <div className="mt-3 grid gap-2">
                    {assignment.checkCalls.length ? (
                      assignment.checkCalls.map((call) => (
                        <div key={call.id} className="rounded-xl border border-border p-3">
                          <p className="font-semibold">{call.status}</p>
                          <p className="muted">
                            {call.location} - {formatDateTime(call.occurredAt)}
                          </p>
                          {call.notes ? <p className="mt-1 text-sm text-slate-700">{call.notes}</p> : null}
                        </div>
                      ))
                    ) : (
                      <p className="muted">No check calls yet.</p>
                    )}
                  </div>
                </div>

                <form action={addCheckCall} className="grid gap-3 rounded-2xl bg-soft p-4">
                  <input type="hidden" name="assignmentId" value={assignment.id} />
                  <input type="hidden" name="loadId" value={assignment.loadId} />
                  <input name="location" className="input" placeholder="Location" required />
                  <input name="status" className="input" placeholder="Status update" required />
                  <textarea name="notes" className="textarea" rows={3} placeholder="Notes" />
                  <input name="nextCheckAt" className="input" type="datetime-local" />
                  <button className="btn" type="submit">
                    Add Check Call
                  </button>
                </form>
              </div>
            </article>
          ))}
        </section>

        <section className="card">
          <h2 className="section-title">Needs Coverage</h2>
          <p className="muted">Open freight that has not been assigned to a carrier.</p>
          <div className="mt-4 grid gap-3">
            {uncoveredLoads.map((load) => (
              <Link key={load.id} href={`/loads/${load.id}`} className="rounded-2xl border border-border p-4 transition hover:bg-soft">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-brand-700">{load.loadNumber}</p>
                    <p className="muted">{load.customer.name}</p>
                  </div>
                  <StatusBadge value={load.status} />
                </div>
                <p className="mt-2 text-sm text-slate-700">
                  {load.pickupCity}, {load.pickupState} to {load.deliveryCity}, {load.deliveryState}
                </p>
                <p className="mt-1 text-sm font-semibold">{formatMoney(load.revenueCents)}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
