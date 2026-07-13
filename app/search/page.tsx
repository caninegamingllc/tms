import { Suspense } from "react";
import { LoadSearchFilters } from "@/components/load-search-filters";
import { LoadSearchResults } from "@/components/load-search-results";
import { PageHeader } from "@/components/page-header";
import { RevenueReportPanel, SearchViewToggle } from "@/components/revenue-report-panel";
import { SearchPrompt } from "@/components/search-prompt";
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

type SearchPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const user = await requireTmsAccess();
  const resolvedSearchParams = await searchParams;
  const filters = parseLoadSearchParams(resolvedSearchParams);
  const view = filters.view ?? "loads";
  const showResults = isSearchSubmitted(resolvedSearchParams);

  const [loads, options] = await Promise.all([
    showResults ? searchLoads(user, filters) : Promise.resolve([]),
    getLoadSearchOptions(user)
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

      <LoadSearchFilters
        filters={{ ...filters, view }}
        customers={options.customers}
        commodities={options.commodities}
      />

      {showResults ? (
        <>
          <div className="mt-6">
            <Suspense fallback={<div className="muted">Loading view...</div>}>
              <SearchViewToggle view={view} />
            </Suspense>
          </div>

          <div className="mt-6">
            {view === "revenue" ? (
              <RevenueReportPanel
                summary={revenueSummary}
                companyName={user.companyName}
                filterSummary={filterSummary}
              />
            ) : (
              <LoadSearchResults
                loads={serializedLoads}
                companyName={user.companyName}
                filterSummary={filterSummary}
              />
            )}
          </div>
        </>
      ) : (
        <div className="mt-6">
          <SearchPrompt entity="loads" />
        </div>
      )}
    </>
  );
}
