import Link from "next/link";
import { LoadSearchFilters } from "@/components/load-search-filters";
import { LoadsTable } from "@/components/loads-table";
import { PageHeader } from "@/components/page-header";
import { SearchPrompt } from "@/components/search-prompt";
import { requireTmsAccess } from "@/lib/permissions";
import { syncMissingCommissions } from "@/lib/commission";
import {
  getLoadSearchOptions,
  parseLoadSearchParams,
  searchLoads
} from "@/lib/load-search";
import { isSearchSubmitted } from "@/lib/list-search";

export default async function LoadsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireTmsAccess();
  const params = await searchParams;
  const filters = parseLoadSearchParams(params);
  const showResults = isSearchSubmitted(params);

  await syncMissingCommissions(user.companyId);

  const [loads, options] = await Promise.all([
    showResults ? searchLoads(user, filters) : Promise.resolve([]),
    getLoadSearchOptions(user)
  ]);

  const rows = loads.map((load) => ({
    id: load.id,
    loadNumber: load.loadNumber,
    title: load.title,
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

      <LoadSearchFilters
        filters={filters}
        customers={options.customers}
        commodities={options.commodities}
        basePath="/loads"
      />

      {showResults ? (
        <section className="card mt-6 overflow-hidden p-0">
          <div className="border-b border-border p-5">
            <h2 className="section-title">Search Results</h2>
            <p className="muted">
              {loads.length} load{loads.length === 1 ? "" : "s"} found. Click any column header to sort.
            </p>
          </div>
          <div className="overflow-x-auto">
            <LoadsTable loads={rows} />
          </div>
        </section>
      ) : (
        <div className="mt-6">
          <SearchPrompt entity="loads" />
        </div>
      )}
    </>
  );
}
