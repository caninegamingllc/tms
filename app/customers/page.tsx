import { PageHeader } from "@/components/page-header";
import { CustomerForm } from "@/components/customer-form";
import { createCustomer } from "@/lib/actions";
import { requireTmsAccess } from "@/lib/permissions";
import { branchScopedWhere, canSeeAllBranches } from "@/lib/scope";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/format";

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
            <p className="muted">Accounts include load count and invoice exposure.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Branch</th>
                  <th>Primary Contact</th>
                  <th>Terms</th>
                  <th>Credit</th>
                  <th>Loads</th>
                  <th>Open AR</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => {
                  const openAr = customer.invoices
                    .filter((invoice) => invoice.status !== "PAID" && invoice.status !== "VOID")
                    .reduce((sum, invoice) => sum + invoice.totalCents, 0);
                  const primary = customer.contacts.find((contact) => contact.isPrimary);

                  return (
                    <tr key={customer.id}>
                      <td>
                        <p className="font-semibold text-ink">{customer.name}</p>
                        <p className="muted">
                          {customer.city ?? "No city"}, {customer.state ?? "No state"}
                        </p>
                      </td>
                      <td>{customer.branch?.name ?? "Unassigned"}</td>
                      <td>
                        <p>{primary?.name ?? "No contact"}</p>
                        <p className="muted">{primary?.email ?? customer.email ?? "No email"}</p>
                      </td>
                      <td>{customer.paymentTerms}</td>
                      <td>{formatMoney(customer.creditLimit)}</td>
                      <td>{customer.loads.length}</td>
                      <td>{formatMoney(openAr)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
