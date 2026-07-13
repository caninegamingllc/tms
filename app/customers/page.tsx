import { CustomerForm } from "@/components/customer-form";
import { CustomerSearchFilters } from "@/components/customer-search-filters";
import { CustomersTable } from "@/components/customers-table";
import { PageHeader } from "@/components/page-header";
import { SearchPrompt } from "@/components/search-prompt";
import { createCustomer } from "@/lib/actions";
import {
  hasActiveCustomerFilters,
  parseCustomerSearchParams,
  searchCustomers
} from "@/lib/customer-search";
import { requireTmsAccess } from "@/lib/permissions";
import { canSeeAllBranches } from "@/lib/scope";
import { prisma } from "@/lib/db";

export default async function CustomersPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireTmsAccess();
  const params = await searchParams;
  const filters = parseCustomerSearchParams(params);
  const hasFilters = hasActiveCustomerFilters(filters);

  const [customers, branches] = await Promise.all([
    hasFilters ? searchCustomers(user, filters) : Promise.resolve([]),
    canSeeAllBranches(user)
      ? prisma.branch.findMany({ where: { companyId: user.companyId }, orderBy: { name: "asc" } })
      : Promise.resolve([])
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

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.8fr]">
        <div className="grid gap-6">
          <CustomerSearchFilters
            filters={filters}
            branches={branches}
            showBranchPicker={canSeeAllBranches(user)}
          />

          {hasFilters ? (
            <section className="card overflow-hidden p-0">
              <div className="border-b border-border p-5">
                <h2 className="section-title">Search Results</h2>
                <p className="muted">
                  {customers.length} customer{customers.length === 1 ? "" : "s"} found. Click column headers to sort.
                </p>
              </div>
              <div className="overflow-x-auto">
                <CustomersTable customers={rows} />
              </div>
            </section>
          ) : (
            <SearchPrompt entity="customers" />
          )}
        </div>

        <section className="card">
          <h2 className="section-title">Add Customer</h2>
          <CustomerForm action={createCustomer} branches={branches} showBranchPicker={canSeeAllBranches(user)} />
        </section>
      </div>
    </>
  );
}
