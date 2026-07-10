import { FacilityForm } from "@/components/facility-form";
import { PageHeader } from "@/components/page-header";
import { createFacility, updateFacility } from "@/lib/actions";
import { requireTmsAccess } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { formatDate, humanize } from "@/lib/format";

export default async function LocationsPage() {
  const user = await requireTmsAccess();
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

  const customerOptions = customers.map((customer) => ({
    id: customer.id,
    name: customer.name
  }));

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
              <div key={facility.id}>
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3 px-1">
                  <div>
                    <p className="font-semibold text-foreground">{facility.name}</p>
                    <p className="muted">
                      {facility.address ? `${facility.address}, ` : ""}
                      {facility.city}, {facility.state} {facility.postalCode ?? ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {humanize(facility.type)} - {facility.customer?.name ?? "No customer link"} -{" "}
                      {facility.loadStops.length} stops - Updated {formatDate(facility.updatedAt)}
                    </p>
                  </div>
                  <span className="badge bg-slate-100 text-slate-700">{facility.status}</span>
                </div>
                <FacilityForm
                  action={updateFacility}
                  customers={customerOptions}
                  facility={{
                    id: facility.id,
                    name: facility.name,
                    type: facility.type,
                    status: facility.status,
                    address: facility.address,
                    city: facility.city,
                    state: facility.state,
                    postalCode: facility.postalCode,
                    contactName: facility.contactName,
                    phone: facility.phone,
                    email: facility.email,
                    customerId: facility.customerId,
                    notes: facility.notes
                  }}
                />
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2 className="section-title">Add Location</h2>
          <FacilityForm action={createFacility} customers={customerOptions} />
        </section>
      </div>
    </>
  );
}
