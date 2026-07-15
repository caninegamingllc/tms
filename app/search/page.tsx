import { Suspense } from "react";
import { LoadSearchFilters } from "@/components/load-search-filters";
import { LoadSearchResults } from "@/components/load-search-results";
import { PageHeader } from "@/components/page-header";
import {
  CustomerVolumeTable,
  LaneSummaryTable,
  LoadProfitabilityTable,
  RevenueMetricsHeader,
  SearchViewToggle
} from "@/components/revenue-report-panel";
import { SearchPrompt } from "@/components/search-prompt";
import { TileBoard, Tile } from "@/components/tile-board";
import { getBranchScope } from "@/lib/branch-filter-server";
import { requireTmsAccess } from "@/lib/permissions";
import { isSearchSubmitted } from "@/lib/list-search";
import {
  buildRevenueSummary,
  describeActiveFilters,
  getLoadSearchOptions,
  parseLoadSearchParams,
  searchLoads,
  serializeSearchLoads
} from "@/lib/load-search";
import { SEARCH_PAGE_TILES } from "@/lib/tile-defaults";
import { loadPageLayouts } from "@/lib/ui-preferences-load";

type SearchPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const user = await requireTmsAccess();
  const resolvedSearchParams = await searchParams;
  const filters = parseLoadSearchParams(resolvedSearchParams);
  const view = filters.view ?? "loads";
  const showResults = isSearchSubmitted(resolvedSearchParams);

  const scope = await getBranchScope(user);
  const [loads, options, layouts] = await Promise.all([
    showResults ? searchLoads(scope, filters) : Promise.resolve([]),
    getLoadSearchOptions(scope),
    loadPageLayouts("search")
  ]);

  const customerName = filters.customerId
    ? options.customers.find((customer) => customer.id === filters.customerId)?.name
    : undefined;
  const filterSummary = describeActiveFilters(filters, customerName);
  const serializedLoads = serializeSearchLoads(loads);
  const revenueSummary = buildRevenueSummary(loads);

  return (
    <>
      <PageHeader
        title="Search & Reports"
        description="Search loads with flexible filters, review results, and export load or revenue reports."
      />

      <TileBoard pageId="search" tiles={SEARCH_PAGE_TILES} initialLayouts={layouts}>
        <Tile id="filters">
          <div className="grid gap-4">
            <LoadSearchFilters
              filters={{ ...filters, view }}
              customers={options.customers}
              commodities={options.commodities}
            />
            {showResults ? (
              <Suspense fallback={<div className="muted">Loading view...</div>}>
                <SearchViewToggle view={view} />
              </Suspense>
            ) : null}
          </div>
        </Tile>

        {!showResults ? (
          <Tile id="load-results">
            <SearchPrompt entity="loads" />
          </Tile>
        ) : null}

        {showResults && view === "loads" ? (
          <Tile id="load-results">
            <LoadSearchResults
              loads={serializedLoads}
              companyName={user.companyName}
              filterSummary={filterSummary}
            />
          </Tile>
        ) : null}

        {showResults && view === "revenue" ? (
          <>
            <Tile id="load-profitability">
              <div className="grid gap-4">
                <RevenueMetricsHeader
                  summary={revenueSummary}
                  companyName={user.companyName}
                  filterSummary={filterSummary}
                />
                <LoadProfitabilityTable summary={revenueSummary} />
              </div>
            </Tile>
            <Tile id="lane-summary">
              <LaneSummaryTable summary={revenueSummary} />
            </Tile>
            <Tile id="customer-volume">
              <CustomerVolumeTable summary={revenueSummary} />
            </Tile>
          </>
        ) : null}
      </TileBoard>
    </>
  );
}
