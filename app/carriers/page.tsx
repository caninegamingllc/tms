import { Suspense } from "react";
import { CarrierLookupForm } from "@/components/carrier-lookup-form";
import { CarrierSearchFilters } from "@/components/carrier-search-filters";
import { CarriersTable } from "@/components/carriers-table";
import { PageHeader } from "@/components/page-header";
import { SearchPrompt } from "@/components/search-prompt";
import { ServerPagination } from "@/components/server-pagination";
import { TileBoard, Tile } from "@/components/tile-board";
import { createCarrier } from "@/lib/actions";
import {
  parseCarrierSearchParams,
  searchCarriers
} from "@/lib/carrier-search";
import { getBranchScope } from "@/lib/branch-filter-server";
import { isSearchSubmitted } from "@/lib/list-search";
import { parsePaginationParams } from "@/lib/pagination";
import { requireTmsAccess } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { LIST_SEARCH_ADD_TILES } from "@/lib/tile-defaults";
import { loadPageLayouts } from "@/lib/ui-preferences-load";

const tiles = LIST_SEARCH_ADD_TILES.map((t) => ({
  ...t,
  title: t.id === "search" ? "Search Carriers" : t.id === "results" ? "Search Results" : "Add Carrier"
}));

export default async function CarriersPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { error, saved, ...filterParams } = params;
  const user = await requireTmsAccess();
  const filters = parseCarrierSearchParams(filterParams);
  const pagination = parsePaginationParams(params);
  const showResults = isSearchSubmitted(params);

  const scope = await getBranchScope(user);
  const [carriersResult, factoringCompanies, layouts] = await Promise.all([
    showResults
      ? searchCarriers(scope, filters, pagination)
      : Promise.resolve({ items: [], total: 0, page: 1, pageSize: pagination.pageSize, totalPages: 0 }),
    prisma.factoringCompany.findMany({
      where: { companyId: user.companyId, status: "Active" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, nameOnCheck: true }
    }),
    loadPageLayouts("carriers")
  ]);

  const rows = carriersResult.items.map((carrier) => {
    const primary = carrier.contacts.find((contact) => contact.isPrimary);
    return {
      id: carrier.id,
      name: carrier.name,
      contact: primary?.email ?? carrier.email ?? carrier.phone ?? "No contact info",
      mcNumber: carrier.mcNumber ?? "MC missing",
      dotNumber: carrier.dotNumber ?? "DOT missing",
      equipmentTypes: carrier.equipmentTypes ?? "Not specified",
      complianceStatus: carrier.complianceStatus,
      safetyRating: carrier.safetyRating ?? "No rating",
      insuranceExpiresAt: carrier.insuranceExpiresAt?.toISOString() ?? null,
      coverageCount: carrier.insuranceCoverages.length,
      loadCount: carrier._count.assignments,
      totalSpendCents: carrier.totalSpendCents
    };
  });

  return (
    <>
      <PageHeader
        title="Carriers"
        description="Track carrier profiles, authority details, insurance, compliance documents, and carrier performance."
      />

      {error ? (
        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}

      {saved ? (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          Carrier saved successfully.
        </div>
      ) : null}

      <TileBoard pageId="carriers" tiles={tiles} initialLayouts={layouts}>
        <Tile id="search">
          <CarrierSearchFilters filters={filters} />
        </Tile>

        <Tile id="results">
          {showResults ? (
            <>
              <p className="muted mb-3">
                {carriersResult.total} carrier{carriersResult.total === 1 ? "" : "s"} found. Click column
                headers to sort this page.
              </p>
              <div className="overflow-x-auto">
                <CarriersTable carriers={rows} paginated={false} />
              </div>
              <Suspense fallback={null}>
                <ServerPagination
                  page={carriersResult.page}
                  pageSize={carriersResult.pageSize}
                  total={carriersResult.total}
                  totalPages={carriersResult.totalPages}
                />
              </Suspense>
            </>
          ) : (
            <SearchPrompt entity="carriers" />
          )}
        </Tile>

        <Tile id="add">
          <CarrierLookupForm action={createCarrier} factoringCompanies={factoringCompanies} />
        </Tile>
      </TileBoard>
    </>
  );
}
