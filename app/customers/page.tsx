import { PageHeader } from "@/components/page-header";
import { createCustomer } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/format";

export default async function CustomersPage() {
  const user = await requireUser();
  const customers = await prisma.customer.findMany({
    where: { companyId: user.companyId },
    orderBy: { name: "asc" },
    include: {
      contacts: true,
      loads: true,
      invoices: true
    }
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
            <p className="muted">Accounts include load count and invoice exposure.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
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
          <form action={createCustomer} className="mt-4 grid gap-3">
            <input name="name" className="input" placeholder="Customer name" required />
            <div className="grid gap-3 md:grid-cols-2">
              <input name="city" className="input" placeholder="City" />
              <input name="state" className="input" placeholder="State" maxLength={2} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input name="phone" className="input" placeholder="Main phone" />
              <input name="email" className="input" placeholder="Main email" type="email" />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input name="industry" className="input" placeholder="Industry" />
              <select name="status" className="select" defaultValue="Active">
                <option>Active</option>
                <option>Prospect</option>
                <option>Credit Hold</option>
                <option>Inactive</option>
              </select>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input name="creditLimit" className="input" placeholder="Credit limit" />
              <input name="paymentTerms" className="input" defaultValue="Net 30" />
            </div>
            <div className="rounded-2xl bg-soft p-4">
              <p className="mb-3 text-sm font-semibold text-ink">Primary Contact</p>
              <div className="grid gap-3">
                <input name="contactName" className="input" placeholder="Contact name" />
                <input name="contactTitle" className="input" placeholder="Title" />
                <input name="contactEmail" className="input" placeholder="Email" type="email" />
                <input name="contactPhone" className="input" placeholder="Phone" />
              </div>
            </div>
            <button className="btn" type="submit">
              Save Customer
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
