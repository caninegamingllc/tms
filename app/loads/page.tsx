import Link from "next/link";
import { after } from "next/server";
import { Suspense } from "react";
import { LoadSearchFilters } from "@/components/load-search-filters";
import { LoadsTable } from "@/components/loads-table";
import { PageHeader } from "@/components/page-header";
import { SearchPrompt } from "@/components/search-prompt";
import { ServerPagination } from "@/components/server-pagination";
import { getBranchScope } from "@/lib/branch-filter-server";
import { requireTmsAccess } from "@/lib/permissions";
import { syncMissingCommissions } from "@/lib/commission";
import {
  getLoadSearchOptions,
  parseLoadSearchParams,
  searchLoads
} from "@/lib/load-search";
import { isSearchSubmitted } from "@/lib/list-search";
import { parsePaginationParams } from "@/lib/pagination";

export default async function LoadsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireTmsAccess();
  const params = await searchParams;
  const filters = parseLoadSearchParams(params);
  const pagination = parsePaginationParams(params);
  const showResults = isSearchSubmitted(params);

  after(() => {
    void syncMissingCommissions(user.companyId);
  });

  const scope = await getBranchScope(user);
  const [loadsResult, options] = await Promise.all([
    showResults
      ? searchLoads(scope, filters, pagination)
      : Promise.resolve({ items: [], total: 0, page: 1, pageSize: pagination.pageSize, totalPages: 0 }),
    getLoadSearchOptions(scope)
  ]);

  const rows = loadsResult.items.map((load) => ({
    id: load.id,
    loadNumber: load.loadNumber,
    status: load.status,
    customerName: load.customer.name,
    pickupCity: load.pickupCity,
    pickupState: load.pickupState,
    deliveryCity: load.deliveryCity,
    deliveryState: load.deliveryState,
    pickupDate: load.pickupDate.toISOString(),
    equipmentType: load.equipmentType,
    commodity: load.commodity,
    carrierName: load.dispatchAssignment?.carrier.name ?? "Uncovered",
    revenueCents: load.revenueCents,
    carrierCostCents: load.carrierCostCents,
    commission: load.commission
      ? {
          branchShareCents: load.commission.branchShareCents,
          status: load.commission.status
        }
      : null
  }));

  return (
    <>
      <PageHeader
        title="Load Management"
        description="Create, search, cover, dispatch, and track customer loads through the full brokerage lifecycle."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/search" className="btn-secondary">
              Advanced Search
            </Link>
            <Link href="/loads/new" className="btn">
              New Load
            </Link>
          </div>
        }
      />

      <section className="card p-5">
        <div className="mb-4">
          <h2 className="section-title">Search Filters</h2>
        </div>
        <LoadSearchFilters
          filters={filters}
          customers={options.customers}
          commodities={options.commodities}
          basePath="/loads"
        />
      </section>

      <section className="card mt-6 p-5">
        <div className="mb-4">
          <h2 className="section-title">Results</h2>
        </div>
        {showResults ? (
          <>
            <p className="muted mb-3">
              {loadsResult.total} load{loadsResult.total === 1 ? "" : "s"} found
            </p>
            <LoadsTable loads={rows} paginated={false} />
            <Suspense fallback={null}>
              <ServerPagination
                page={loadsResult.page}
                pageSize={loadsResult.pageSize}
                total={loadsResult.total}
                totalPages={loadsResult.totalPages}
              />
            </Suspense>
          </>
        ) : (
          <SearchPrompt entity="loads" />
        )}
      </section>
    </>
  );
}
