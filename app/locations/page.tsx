import { Suspense } from "react";
import { FacilityForm } from "@/components/facility-form";
import { LocationSearchFilters } from "@/components/location-search-filters";
import { PageHeader } from "@/components/page-header";
import { SearchPrompt } from "@/components/search-prompt";
import { ServerPagination } from "@/components/server-pagination";
import { TileBoard, Tile } from "@/components/tile-board";
import { createFacility, updateFacility } from "@/lib/actions";
import {
  parseLocationSearchParams,
  searchLocations
} from "@/lib/location-search";
import { getBranchScope } from "@/lib/branch-filter-server";
import { isSearchSubmitted } from "@/lib/list-search";
import { parsePaginationParams } from "@/lib/pagination";
import { requirePlanFeature } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { formatDate, humanize } from "@/lib/format";
import { LIST_SEARCH_ADD_TILES } from "@/lib/tile-defaults";
import { loadPageLayoutContext } from "@/lib/ui-preferences-load";

const tiles = LIST_SEARCH_ADD_TILES.map((t) => ({
  ...t,
  title: t.id === "search" ? "Search Locations" : t.id === "results" ? "Search Results" : "Add Location"
}));

export default async function LocationsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePlanFeature("locations");
  const params = await searchParams;
  const { saved, ...filterParams } = params;
  const filters = parseLocationSearchParams(filterParams);
  const pagination = parsePaginationParams(params);
  const showResults = isSearchSubmitted(params);

  const scope = await getBranchScope(user);
  const [facilitiesResult, customers, layoutContext] = await Promise.all([
    showResults
      ? searchLocations(scope, filters, pagination)
      : Promise.resolve({ items: [], total: 0, page: 1, pageSize: pagination.pageSize, totalPages: 0 }),
    prisma.customer.findMany({
      where: scope,
      orderBy: { name: "asc" },
      select: { id: true, name: true }
    }),
    loadPageLayoutContext("locations")
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

      <TileBoard
        pageId="locations"
        tiles={tiles}
        initialLayouts={layoutContext.layouts}
        orgDefaultLayouts={layoutContext.orgDefaultLayouts}
        canSetOrgDefault={layoutContext.canSetOrgDefault}
      >
        <Tile id="search">
          <LocationSearchFilters filters={filters} customers={customerOptions} />
        </Tile>

        <Tile id="results">
          {showResults ? (
            <>
              <p className="muted mb-3">
                {facilitiesResult.total} location{facilitiesResult.total === 1 ? "" : "s"} found.
                Selecting a saved location on a load snapshots its address onto the stop.
              </p>
              <div className="grid gap-4">
                {facilitiesResult.items.map((facility) => (
                  <div key={facility.id}>
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-foreground">{facility.name}</p>
                        <p className="muted">
                          {facility.address ? `${facility.address}, ` : ""}
                          {facility.city}, {facility.state} {facility.postalCode ?? ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {humanize(facility.type)} - {facility.customer?.name ?? "No customer link"} -{" "}
                          {facility._count.loadStops} stops - Updated {formatDate(facility.updatedAt)}
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
              <Suspense fallback={null}>
                <ServerPagination
                  page={facilitiesResult.page}
                  pageSize={facilitiesResult.pageSize}
                  total={facilitiesResult.total}
                  totalPages={facilitiesResult.totalPages}
                />
              </Suspense>
            </>
          ) : (
            <SearchPrompt entity="locations" />
          )}
        </Tile>

        <Tile id="add">
          <FacilityForm action={createFacility} customers={customerOptions} />
        </Tile>
      </TileBoard>
    </>
  );
}
