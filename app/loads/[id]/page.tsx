import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { SearchCombobox } from "@/components/search-combobox";
import { StatusBadge } from "@/components/status-badge";
import {
  addCheckCall,
  addDocument,
  assignCarrier,
  generateBillOfLading,
  generateCustomerInvoice,
  generateRateConfirmation,
  updateLoadStatus
} from "@/lib/actions";
import { requireTmsAccess } from "@/lib/permissions";
import { canAccessBranchRecord } from "@/lib/scope";
import { documentTypes, loadStatuses } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { formatDate, formatDateTime, formatMoney, humanize, marginPercent } from "@/lib/format";

export default async function LoadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireTmsAccess();
  const [load, carriers] = await Promise.all([
    prisma.load.findUnique({
      where: { id, companyId: user.companyId },
      include: {
        customer: true,
        stops: { orderBy: { sequence: "asc" } },
        charges: true,
        documents: true,
        notes: { orderBy: { createdAt: "desc" }, include: { user: true } },
        activities: { orderBy: { createdAt: "desc" }, include: { user: true } },
        dispatchAssignment: {
          include: {
            carrier: true,
            checkCalls: { orderBy: { occurredAt: "desc" } }
          }
        },
        invoices: true,
        carrierBills: { include: { carrier: true } }
      }
    }),
    prisma.carrier.findMany({ where: { companyId: user.companyId }, orderBy: { name: "asc" } })
  ]);

  if (!load || !canAccessBranchRecord(user, load.branchId)) {
    notFound();
  }

  const carrierOptions = carriers.map((carrier) => ({
    id: carrier.id,
    label: carrier.name,
    description: [
      carrier.mcNumber,
      carrier.dotNumber,
      carrier.complianceStatus,
      carrier.insuranceExpiresAt ? `Insurance ${formatDate(carrier.insuranceExpiresAt)}` : "Insurance missing"
    ]
      .filter(Boolean)
      .join(" - ")
  }));

  return (
    <>
      <PageHeader
        title={`${load.loadNumber}: ${load.title}`}
        description={`${load.customer.name} freight from ${load.pickupCity}, ${load.pickupState} to ${load.deliveryCity}, ${load.deliveryState}.`}
      />

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.9fr]">
        <div className="grid gap-6">
          <section className="card">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <StatusBadge value={load.status} />
                <h2 className="mt-3 text-2xl font-bold text-ink">{load.title}</h2>
                <p className="muted">
                  {load.equipmentType} - {load.commodity ?? "General freight"} -{" "}
                  {load.weight ? `${load.weight.toLocaleString()} lbs` : "Weight TBD"}
                </p>
              </div>
              <div className="grid gap-1 text-right">
                <span className="text-sm text-muted">Gross margin</span>
                <span className="text-2xl font-bold text-ink">
                  {formatMoney(load.revenueCents - load.carrierCostCents)}
                </span>
                <span className="text-sm text-muted">
                  {marginPercent(load.revenueCents, load.carrierCostCents)}
                </span>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-soft p-4">
                <p className="label">Customer Rate</p>
                <p className="mt-2 text-xl font-semibold">{formatMoney(load.revenueCents)}</p>
              </div>
              <div className="rounded-2xl bg-soft p-4">
                <p className="label">Carrier Cost</p>
                <p className="mt-2 text-xl font-semibold">{formatMoney(load.carrierCostCents)}</p>
              </div>
              <div className="rounded-2xl bg-soft p-4">
                <p className="label">Reference</p>
                <p className="mt-2 text-xl font-semibold">{load.referenceNumber ?? "None"}</p>
              </div>
            </div>
          </section>

          <section className="card">
            <h2 className="section-title">Stops</h2>
            <div className="mt-4 grid gap-3">
              {load.stops.map((stop) => (
                <div key={stop.id} className="rounded-2xl border border-border p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-ink">
                        {stop.sequence}. {humanize(stop.type)} - {stop.facilityName}
                      </p>
                      <p className="muted">
                        {stop.city}, {stop.state}
                      </p>
                    </div>
                    <span className="text-sm text-muted">{formatDateTime(stop.appointmentAt)}</span>
                  </div>
                  {stop.instructions ? (
                    <p className="mt-3 rounded-xl bg-soft p-3 text-sm text-slate-700">
                      {stop.instructions}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="section-title">Documents</h2>
                <p className="muted">Generate printable carrier, shipper, and customer paperwork.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <form action={generateRateConfirmation}>
                  <input type="hidden" name="loadId" value={load.id} />
                  <button className="btn-secondary" type="submit" disabled={!load.dispatchAssignment}>
                    Generate Rate Con
                  </button>
                </form>
                <form action={generateBillOfLading}>
                  <input type="hidden" name="loadId" value={load.id} />
                  <button className="btn-secondary" type="submit">
                    Generate BOL
                  </button>
                </form>
                <form action={generateCustomerInvoice}>
                  <input type="hidden" name="loadId" value={load.id} />
                  <button className="btn-secondary" type="submit">
                    Generate Invoice
                  </button>
                </form>
              </div>
            </div>
            <div className="mt-4 grid gap-3">
              {load.documents.map((document) => (
                <div key={document.id} className="flex items-center justify-between rounded-2xl border border-border p-4">
                  <div>
                    <p className="font-semibold text-ink">{document.name}</p>
                    <p className="muted">
                      {humanize(document.type)} - {document.documentNumber ?? document.filePath ?? "No file path"}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-muted">{formatDate(document.uploadedAt)}</span>
                    <Link href={`/documents/${document.id}`} className="mt-2 block text-sm font-semibold text-brand-700">
                      Preview
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            <form action={addDocument} className="mt-5 grid gap-3 rounded-2xl bg-soft p-4 md:grid-cols-4">
              <input type="hidden" name="loadId" value={load.id} />
              <label className="grid gap-2">
                <span className="label">Type</span>
                <select name="type" className="select">
                  {documentTypes.map((type) => (
                    <option key={type} value={type}>
                      {humanize(type)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2">
                <span className="label">Name</span>
                <input name="name" className="input" required />
              </label>
              <label className="grid gap-2">
                <span className="label">File Path</span>
                <input name="filePath" className="input" placeholder="/uploads/file.pdf" />
              </label>
              <div className="flex items-end">
                <button className="btn w-full" type="submit">
                  Add Document
                </button>
              </div>
            </form>
          </section>
        </div>

        <aside className="grid gap-6">
          <section className="card">
            <h2 className="section-title">Workflow</h2>
            <form action={updateLoadStatus} className="mt-4 grid gap-3">
              <input type="hidden" name="loadId" value={load.id} />
              <select name="status" className="select" defaultValue={load.status}>
                {loadStatuses.map((status) => (
                  <option key={status} value={status}>
                    {humanize(status)}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn">
                Update Status
              </button>
            </form>
          </section>

          <section className="card">
            <h2 className="section-title">Carrier Assignment</h2>
            <p className="muted">
              Current carrier: {load.dispatchAssignment?.carrier.name ?? "Not covered"}
            </p>
            <form action={assignCarrier} className="mt-4 grid gap-3">
              <input type="hidden" name="loadId" value={load.id} />
              <SearchCombobox
                name="carrierId"
                label="Carrier"
                placeholder="Search carriers"
                options={carrierOptions}
                defaultValue={load.dispatchAssignment?.carrierId ?? ""}
                required
              />
              <input
                name="rate"
                className="input"
                defaultValue={load.dispatchAssignment ? load.dispatchAssignment.rateCents / 100 : ""}
                placeholder="Carrier rate"
                required
              />
              <input name="driverName" className="input" placeholder="Driver name" defaultValue={load.dispatchAssignment?.driverName ?? ""} />
              <input name="driverPhone" className="input" placeholder="Driver phone" defaultValue={load.dispatchAssignment?.driverPhone ?? ""} />
              <div className="grid gap-3 md:grid-cols-2">
                <input name="truckNumber" className="input" placeholder="Truck #" defaultValue={load.dispatchAssignment?.truckNumber ?? ""} />
                <input name="trailerNumber" className="input" placeholder="Trailer #" defaultValue={load.dispatchAssignment?.trailerNumber ?? ""} />
              </div>
              <button type="submit" className="btn">
                Save Assignment
              </button>
            </form>
          </section>

          {load.dispatchAssignment ? (
            <section className="card">
              <h2 className="section-title">Check Calls</h2>
              <div className="mt-4 grid gap-3">
                {load.dispatchAssignment.checkCalls.map((call) => (
                  <div key={call.id} className="rounded-2xl border border-border p-3">
                    <p className="font-semibold text-ink">{call.status}</p>
                    <p className="muted">{call.location}</p>
                    <p className="text-xs text-muted">{formatDateTime(call.occurredAt)}</p>
                    {call.notes ? <p className="mt-2 text-sm text-slate-700">{call.notes}</p> : null}
                  </div>
                ))}
              </div>
              <form action={addCheckCall} className="mt-4 grid gap-3 rounded-2xl bg-soft p-4">
                <input type="hidden" name="assignmentId" value={load.dispatchAssignment.id} />
                <input type="hidden" name="loadId" value={load.id} />
                <input name="location" className="input" placeholder="Location" required />
                <input name="status" className="input" placeholder="Status update" required />
                <textarea name="notes" className="textarea" placeholder="Notes" rows={3} />
                <input name="nextCheckAt" className="input" type="datetime-local" />
                <button className="btn" type="submit">
                  Add Check Call
                </button>
              </form>
            </section>
          ) : null}

          <section className="card">
            <h2 className="section-title">Accounting</h2>
            <div className="mt-4 grid gap-3">
              {load.invoices.map((invoice) => (
                <div key={invoice.id} className="rounded-2xl bg-soft p-3">
                  <p className="font-semibold">{invoice.invoiceNo}</p>
                  <p className="muted">
                    {formatMoney(invoice.totalCents)} - {humanize(invoice.status)}
                  </p>
                </div>
              ))}
              {load.carrierBills.map((bill) => (
                <div key={bill.id} className="rounded-2xl bg-soft p-3">
                  <p className="font-semibold">{bill.billNo}</p>
                  <p className="muted">
                    {bill.carrier.name} - {formatMoney(bill.totalCents)} - {humanize(bill.status)}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <h2 className="section-title">Activity Log</h2>
            <div className="mt-4 grid gap-3">
              {load.activities.map((activity) => (
                <div key={activity.id} className="rounded-2xl border border-border p-3">
                  <p className="font-semibold text-ink">{activity.action}</p>
                  <p className="muted">{activity.details ?? "No details"}</p>
                  <p className="text-xs text-muted">{formatDateTime(activity.createdAt)}</p>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
