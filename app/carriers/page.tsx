import { CarrierLookupForm } from "@/components/carrier-lookup-form";
import { CarrierSearchFilters } from "@/components/carrier-search-filters";
import { CarriersTable } from "@/components/carriers-table";
import { PageHeader } from "@/components/page-header";
import { SearchPrompt } from "@/components/search-prompt";
import { createCarrier } from "@/lib/actions";
import {
  hasActiveCarrierFilters,
  parseCarrierSearchParams,
  searchCarriers
} from "@/lib/carrier-search";
import { requireTmsAccess } from "@/lib/permissions";

export default async function CarriersPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { error, ...filterParams } = params;
  const user = await requireTmsAccess();
  const filters = parseCarrierSearchParams(filterParams);
  const hasFilters = hasActiveCarrierFilters(filters);

  const carriers = hasFilters ? await searchCarriers(user, filters) : [];

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

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.8fr]">
        <div className="grid gap-6">
          <CarrierSearchFilters filters={filters} />

          {hasFilters ? (
            <section className="card overflow-hidden p-0">
              <div className="border-b border-border p-5">
                <h2 className="section-title">Search Results</h2>
                <p className="muted">
                  {carriers.length} carrier{carriers.length === 1 ? "" : "s"} found. Click column headers to sort.
                </p>
              </div>
              <div className="overflow-x-auto">
                <CarriersTable carriers={rows} />
              </div>
            </section>
          ) : (
            <SearchPrompt entity="carriers" />
          )}
        </div>

        <section className="card">
          <h2 className="section-title">Add Carrier</h2>
          <CarrierLookupForm action={createCarrier} />
        </section>
      </div>
    </>
  );
}
