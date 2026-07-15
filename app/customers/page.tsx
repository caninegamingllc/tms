import { CustomerForm } from "@/components/customer-form";
import { CustomerSearchFilters } from "@/components/customer-search-filters";
import { CustomersTable } from "@/components/customers-table";
import { PageHeader } from "@/components/page-header";
import { SearchPrompt } from "@/components/search-prompt";
import { TileBoard, Tile } from "@/components/tile-board";
import { createCustomer } from "@/lib/actions";
import {
  parseCustomerSearchParams,
  searchCustomers
} from "@/lib/customer-search";
import { getBranchScope } from "@/lib/branch-filter-server";
import { isSearchSubmitted } from "@/lib/list-search";
import { requireTmsAccess } from "@/lib/permissions";
import { canPickBranch, isAdminRole } from "@/lib/scope";
import { prisma } from "@/lib/db";
import { LIST_SEARCH_ADD_TILES } from "@/lib/tile-defaults";
import { loadPageLayouts } from "@/lib/ui-preferences-load";

const tiles = LIST_SEARCH_ADD_TILES.map((t) => ({
  ...t,
  title: t.id === "search" ? "Search Customers" : t.id === "results" ? "Search Results" : "Add Customer"
}));

export default async function CustomersPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireTmsAccess();
  const params = await searchParams;
  const { saved, ...filterParams } = params;
  const filters = parseCustomerSearchParams(filterParams);
  const showResults = isSearchSubmitted(params);

  const scope = await getBranchScope(user);
  const [customers, branches, layouts] = await Promise.all([
    showResults ? searchCustomers(scope, filters) : Promise.resolve([]),
    canPickBranch(user)
      ? prisma.branch.findMany({
          where: {
            companyId: user.companyId,
            ...(isAdminRole(user.role) ? {} : { id: { in: user.branchIds } })
          },
          orderBy: { name: "asc" }
        })
      : Promise.resolve([]),
    loadPageLayouts("customers")
  ]);

  const rows = customers.map((customer) => {
    const openAr = customer.invoices
      .filter((invoice) => invoice.status !== "PAID" && invoice.status !== "VOID")
      .reduce((sum, invoice) => sum + invoice.totalCents, 0);
    const primary = customer.contacts.find((contact) => contact.isPrimary);

    return {
      id: customer.id,
      name: customer.name,
      city: customer.city ?? "No city",
      state: customer.state ?? "No state",
      branchName: customer.branch?.name ?? "Unassigned",
      contactName: primary?.name ?? "No contact",
      contactEmail: primary?.email ?? customer.email ?? "No email",
      paymentTerms: customer.paymentTerms,
      creditLimit: customer.creditLimit,
      loadCount: customer.loads.length,
      openArCents: openAr
    };
  });

  return (
    <>
      <PageHeader
        title="Customers"
        description="Manage shipper accounts, contacts, credit limits, payment terms, lane history, and open receivables."
      />

      {saved ? (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          Customer saved successfully.
        </div>
      ) : null}

      <TileBoard pageId="customers" tiles={tiles} initialLayouts={layouts}>
        <Tile id="search">
          <CustomerSearchFilters filters={filters} />
        </Tile>

        <Tile id="results">
          {showResults ? (
            <>
              <p className="muted mb-3">
                {customers.length} customer{customers.length === 1 ? "" : "s"} found. Click column headers
                to sort.
              </p>
              <div className="overflow-x-auto">
                <CustomersTable customers={rows} />
              </div>
            </>
          ) : (
            <SearchPrompt entity="customers" />
          )}
        </Tile>

        <Tile id="add">
          <CustomerForm action={createCustomer} branches={branches} showBranchPicker={canPickBranch(user)} />
        </Tile>
      </TileBoard>
    </>
  );
}
