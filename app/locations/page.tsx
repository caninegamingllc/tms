import { PageHeader } from "@/components/page-header";
import { createFacility, updateFacility } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { facilityTypes } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { formatDate, humanize } from "@/lib/format";

export default async function LocationsPage() {
  const user = await requireUser();
  const [facilities, customers] = await Promise.all([
    prisma.facility.findMany({
      where: { companyId: user.companyId },
      orderBy: [{ name: "asc" }, { city: "asc" }],
      include: { customer: true, loadStops: true }
    }),
    prisma.customer.findMany({
      where: { companyId: user.companyId },
      orderBy: { name: "asc" }
    })
  ]);

  return (
    <>
      <PageHeader
        title="Locations"
        description="Store pickup, delivery, distribution center, port, and rail locations for future load entry."
      />

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.8fr]">
        <section className="card overflow-hidden p-0">
          <div className="border-b border-border p-5">
            <h2 className="section-title">Saved Facility Locations</h2>
            <p className="muted">Selecting a saved location on a load snapshots its address onto the stop.</p>
          </div>
          <div className="grid gap-4 p-5">
            {facilities.map((facility) => (
              <form
                key={facility.id}
                action={updateFacility}
                className="grid gap-3 rounded-2xl border border-border p-4"
              >
                <input type="hidden" name="facilityId" value={facility.id} />
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{facility.name}</p>
                    <p className="muted">
                      {facility.address ? `${facility.address}, ` : ""}
                      {facility.city}, {facility.state} {facility.postalCode ?? ""}
                    </p>
                    <p className="text-xs text-muted">
                      {humanize(facility.type)} - {facility.customer?.name ?? "No customer link"} -{" "}
                      {facility.loadStops.length} stops - Updated {formatDate(facility.updatedAt)}
                    </p>
                  </div>
                  <span className="badge bg-slate-100 text-slate-700">{facility.status}</span>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <input name="name" className="input" defaultValue={facility.name} required />
                  <select name="type" className="select" defaultValue={facility.type}>
                    {facilityTypes.map((type) => (
                      <option key={type} value={type}>
                        {humanize(type)}
                      </option>
                    ))}
                  </select>
                  <select name="status" className="select" defaultValue={facility.status}>
                    <option>Active</option>
                    <option>Inactive</option>
                  </select>
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  <input name="address" className="input md:col-span-2" defaultValue={facility.address ?? ""} placeholder="Address" />
                  <input name="city" className="input" defaultValue={facility.city} placeholder="City" required />
                  <input name="state" className="input" defaultValue={facility.state} placeholder="State" maxLength={2} required />
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  <input name="postalCode" className="input" defaultValue={facility.postalCode ?? ""} placeholder="Postal code" />
                  <input name="contactName" className="input" defaultValue={facility.contactName ?? ""} placeholder="Contact" />
                  <input name="phone" className="input" defaultValue={facility.phone ?? ""} placeholder="Phone" />
                  <input name="email" className="input" defaultValue={facility.email ?? ""} placeholder="Email" type="email" />
                </div>
                <select name="customerId" className="select" defaultValue={facility.customerId ?? ""}>
                  <option value="">No customer link</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
                <textarea name="notes" className="textarea" defaultValue={facility.notes ?? ""} placeholder="Notes" rows={2} />
                <div className="flex justify-end">
                  <button className="btn-secondary" type="submit">
                    Save Location
                  </button>
                </div>
              </form>
            ))}
          </div>
        </section>

        <section className="card">
          <h2 className="section-title">Add Location</h2>
          <form action={createFacility} className="mt-4 grid gap-3">
            <input name="name" className="input" placeholder="Facility name" required />
            <div className="grid gap-3 md:grid-cols-2">
              <select name="type" className="select" defaultValue="GENERAL">
                {facilityTypes.map((type) => (
                  <option key={type} value={type}>
                    {humanize(type)}
                  </option>
                ))}
              </select>
              <select name="status" className="select" defaultValue="Active">
                <option>Active</option>
                <option>Inactive</option>
              </select>
            </div>
            <input name="address" className="input" placeholder="Street address" />
            <div className="grid gap-3 md:grid-cols-3">
              <input name="city" className="input" placeholder="City" required />
              <input name="state" className="input" placeholder="State" maxLength={2} required />
              <input name="postalCode" className="input" placeholder="Postal code" />
            </div>
            <select name="customerId" className="select" defaultValue="">
              <option value="">No customer link</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
            <div className="grid gap-3 md:grid-cols-3">
              <input name="contactName" className="input" placeholder="Contact" />
              <input name="phone" className="input" placeholder="Phone" />
              <input name="email" className="input" placeholder="Email" type="email" />
            </div>
            <textarea name="notes" className="textarea" placeholder="Notes" rows={3} />
            <button className="btn" type="submit">
              Save Location
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
