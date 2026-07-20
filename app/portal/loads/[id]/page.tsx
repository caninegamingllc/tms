import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomerPortalShell } from "@/components/customer-portal-shell";
import { StatusBadge } from "@/components/status-badge";
import { CUSTOMER_FACING_DOCUMENT_TYPES, getLoadBoardStage } from "@/lib/customer-board";
import { carrierDisplayName, primaryAssignment } from "@/lib/dispatch-assignment";
import { prisma } from "@/lib/db";
import { formatDate, formatDateTime, humanize } from "@/lib/format";
import { requirePortalViewer } from "@/lib/portal-auth";

export default async function PortalLoadDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requirePortalViewer();
  const { id } = await params;

  const load = await prisma.load.findFirst({
    where: {
      id,
      companyId: viewer.companyId,
      customerId: viewer.customerId,
      status: { not: "CANCELED" }
    },
    include: {
      stops: { orderBy: { sequence: "asc" } },
      documents: {
        where: {
          type: { in: [...CUSTOMER_FACING_DOCUMENT_TYPES] }
        },
        orderBy: { uploadedAt: "desc" },
        select: {
          id: true,
          type: true,
          name: true,
          filePath: true,
          uploadedAt: true
        }
      },
      dispatchAssignments: {
        orderBy: { sequence: "asc" },
        include: {
          carrier: { select: { name: true } },
          checkCalls: {
            orderBy: { occurredAt: "desc" },
            take: 5,
            select: {
              location: true,
              occurredAt: true,
              notes: true
            }
          }
        }
      }
    }
  });

  if (!load) {
    notFound();
  }

  const boardStage = getLoadBoardStage(load);
  const primary = primaryAssignment(load.dispatchAssignments);
  const carrierLabel = carrierDisplayName(load.dispatchAssignments);
  const recentCheckCalls = load.dispatchAssignments
    .flatMap((row) => row.checkCalls)
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
    .slice(0, 5);

  return (
    <CustomerPortalShell viewer={viewer}>
      <div className="grid gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/portal" className="text-sm font-semibold text-primary">
              ← Back to overview
            </Link>
            <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight">
              Load {load.loadNumber}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {load.pickupCity}, {load.pickupState} → {load.deliveryCity}, {load.deliveryState}
            </p>
          </div>
          <StatusBadge value={load.status} />
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="label">Stage</p>
            <p className="font-semibold">{boardStage ? humanize(boardStage) : "—"}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="label">Equipment</p>
            <p className="font-semibold">{load.equipmentType}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="label">Commodity</p>
            <p className="font-semibold">{load.commodity ?? "General freight"}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="label">Reference</p>
            <p className="font-semibold">{load.referenceNumber ?? "—"}</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="section-title">Stops</h2>
            <div className="mt-4 grid gap-3">
              {load.stops.length ? (
                load.stops.map((stop) => (
                  <div key={stop.id} className="rounded-xl bg-muted p-3 text-sm">
                    <p className="font-semibold">
                      {stop.sequence}. {humanize(stop.type)} — {stop.facilityName}
                    </p>
                    <p className="muted">
                      {[stop.address, stop.city, stop.state, stop.postalCode].filter(Boolean).join(", ")}
                    </p>
                    {stop.appointmentAt ? (
                      <p className="muted">Appt {formatDateTime(stop.appointmentAt)}</p>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="muted">
                  {load.pickupCity}, {load.pickupState} → {load.deliveryCity}, {load.deliveryState}
                </p>
              )}
            </div>
            <div className="mt-4 grid gap-2 text-sm">
              <p>
                <span className="label">Pickup</span> {formatDate(load.pickupDate)}
              </p>
              <p>
                <span className="label">Delivery</span> {formatDate(load.deliveryDate)}
              </p>
              {load.weight != null ? (
                <p>
                  <span className="label">Weight</span> {load.weight.toLocaleString()} lbs
                </p>
              ) : null}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="section-title">Carrier & driver</h2>
            {primary ? (
              <div className="mt-4 grid gap-3 text-sm">
                <div>
                  <p className="label">Carrier</p>
                  <p className="font-semibold">
                    {carrierLabel !== "Uncovered" ? carrierLabel : primary.driverName ?? "Assigned"}
                  </p>
                </div>
                <div>
                  <p className="label">Driver</p>
                  <p className="font-semibold">{primary.driverName ?? "TBD"}</p>
                  <p className="muted">{primary.driverPhone ?? "No phone"}</p>
                </div>
                <div>
                  <p className="label">Truck / trailer</p>
                  <p className="font-semibold">
                    {primary.truckNumber ?? "Truck TBD"} / {primary.trailerNumber ?? "Trailer TBD"}
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-4 muted">Not yet covered with a carrier.</p>
            )}

            <h3 className="mt-6 text-sm font-semibold">Recent check calls</h3>
            <div className="mt-3 grid gap-2">
              {recentCheckCalls.length ? (
                recentCheckCalls.map((call, index) => (
                  <div key={`${call.occurredAt.toISOString()}-${index}`} className="rounded-xl bg-muted p-3 text-sm">
                    <p className="font-semibold">{call.notes ?? "Check call"}</p>
                    <p className="muted">{call.location}</p>
                    <p className="muted">{formatDateTime(call.occurredAt)}</p>
                  </div>
                ))
              ) : (
                <p className="muted">No check calls yet.</p>
              )}
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="section-title">Documents</h2>
          <div className="mt-4 grid gap-2">
            {load.documents.length ? (
              load.documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-semibold">{doc.name}</p>
                    <p className="muted">
                      {humanize(doc.type)} · {formatDateTime(doc.uploadedAt)}
                    </p>
                  </div>
                  {doc.filePath ? (
                    <a
                      className="btn-secondary"
                      href={`/api/portal/documents/${doc.id}/file`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View
                    </a>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="muted">No customer documents available yet.</p>
            )}
          </div>
        </section>
      </div>
    </CustomerPortalShell>
  );
}
