import { FacilityForm } from "@/components/facility-form";
import { LocationSearchFilters } from "@/components/location-search-filters";
import { PageHeader } from "@/components/page-header";
import { SearchPrompt } from "@/components/search-prompt";
import { createFacility, updateFacility } from "@/lib/actions";
import {
  parseLocationSearchParams,
  searchLocations
} from "@/lib/location-search";
import { getBranchScope } from "@/lib/branch-filter-server";
import { isSearchSubmitted } from "@/lib/list-search";
import { requireTmsAccess } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { formatDate, humanize } from "@/lib/format";

export default async function LocationsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireTmsAccess();
  const params = await searchParams;
  const { saved, ...filterParams } = params;
  const filters = parseLocationSearchParams(filterParams);
  const showResults = isSearchSubmitted(params);

  const scope = await getBranchScope(user);
  const [facilities, customers] = await Promise.all([
    showResults ? searchLocations(scope, filters) : Promise.resolve([]),
    prisma.customer.findMany({
      where: scope,
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

      {saved ? (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          Location saved successfully.
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.8fr]">
        <div className="grid gap-6">
          <LocationSearchFilters filters={filters} customers={customerOptions} />

          {showResults ? (
            <section className="card overflow-hidden p-0">
              <div className="border-b border-border p-5">
                <h2 className="section-title">Search Results</h2>
                <p className="muted">
                  {facilities.length} location{facilities.length === 1 ? "" : "s"} found. Selecting a saved location on a load snapshots its address onto the stop.
                </p>
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
          ) : (
            <SearchPrompt entity="locations" />
          )}
        </div>

        <section className="card">
          <h2 className="section-title">Add Location</h2>
          <FacilityForm action={createFacility} customers={customerOptions} />
        </section>
      </div>
    </>
  );
}
