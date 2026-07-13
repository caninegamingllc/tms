import { PageHeader } from "@/components/page-header";
import { CustomerForm } from "@/components/customer-form";
import { CustomersTable } from "@/components/customers-table";
import { createCustomer } from "@/lib/actions";
import { requireTmsAccess } from "@/lib/permissions";
import { branchScopedWhere, canSeeAllBranches } from "@/lib/scope";
import { prisma } from "@/lib/db";

export default async function CustomersPage() {
  const user = await requireTmsAccess();
  const [customers, branches] = await Promise.all([
    prisma.customer.findMany({
      where: branchScopedWhere(user),
      orderBy: { name: "asc" },
      include: {
        contacts: true,
        loads: true,
        invoices: true,
        branch: true
      }
    }),
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
        <section className="card overflow-hidden p-0">
          <div className="border-b border-border p-5">
            <h2 className="section-title">Customer Accounts</h2>
            <p className="muted">Accounts include load count and invoice exposure. Click column headers to sort.</p>
          </div>
          <div className="overflow-x-auto">
            <CustomersTable customers={rows} />
          </div>
        </section>

        <section className="card">
          <h2 className="section-title">Add Customer</h2>
          <CustomerForm action={createCustomer} branches={branches} showBranchPicker={canSeeAllBranches(user)} />
        </section>
      </div>
    </>
  );
}
