import { CarrierLookupForm } from "@/components/carrier-lookup-form";
import { CarrierSearchFilters } from "@/components/carrier-search-filters";
import { CarriersTable } from "@/components/carriers-table";
import { PageHeader } from "@/components/page-header";
import { SearchPrompt } from "@/components/search-prompt";
import { TileBoard, Tile } from "@/components/tile-board";
import { createCarrier } from "@/lib/actions";
import {
  parseCarrierSearchParams,
  searchCarriers
} from "@/lib/carrier-search";
import { getBranchScope } from "@/lib/branch-filter-server";
import { isSearchSubmitted } from "@/lib/list-search";
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
  const showResults = isSearchSubmitted(params);

  const scope = await getBranchScope(user);
  const [carriers, factoringCompanies, layouts] = await Promise.all([
    showResults ? searchCarriers(scope, filters) : Promise.resolve([]),
    prisma.factoringCompany.findMany({
      where: { companyId: user.companyId, status: "Active" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, nameOnCheck: true }
    }),
    loadPageLayouts("carriers")
  ]);

  const rows = carriers.map((carrier) => {
    const totalSpend = carrier.assignments.reduce((sum, assignment) => sum + assignment.rateCents, 0);

    return {
      id: carrier.id,
      name: carrier.name,
      contact: carrier.email ?? carrier.phone ?? "No contact info",
      mcNumber: carrier.mcNumber ?? "MC missing",
      dotNumber: carrier.dotNumber ?? "DOT missing",
      equipmentTypes: carrier.equipmentTypes ?? "Not specified",
      complianceStatus: carrier.complianceStatus,
      safetyRating: carrier.safetyRating ?? "No rating",
      insuranceExpiresAt: carrier.insuranceExpiresAt?.toISOString() ?? null,
      coverageCount: carrier.insuranceCoverages.length,
      loadCount: carrier.assignments.length,
      totalSpendCents: totalSpend
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
                {carriers.length} carrier{carriers.length === 1 ? "" : "s"} found. Click column headers to
                sort.
              </p>
              <div className="overflow-x-auto">
                <CarriersTable carriers={rows} />
              </div>
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
