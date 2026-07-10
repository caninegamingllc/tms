import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { createCarrierBill, createInvoice, generateCustomerInvoice } from "@/lib/actions";
import { requireTmsAccess } from "@/lib/permissions";
import { branchScopedWhere } from "@/lib/scope";
import { paymentStatuses } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { formatDate, formatMoney, humanize } from "@/lib/format";

export default async function AccountingPage() {
  const user = await requireTmsAccess();
  const loadScope = branchScopedWhere(user);
  const [loads, invoices, carrierBills, carriers] = await Promise.all([
    prisma.load.findMany({
      where: loadScope,
      orderBy: { loadNumber: "desc" },
      include: { customer: true, dispatchAssignment: true }
    }),
    prisma.invoice.findMany({
      where: { companyId: user.companyId, load: loadScope },
      orderBy: { createdAt: "desc" },
      include: { customer: true, load: true }
    }),
    prisma.carrierBill.findMany({
      where: { companyId: user.companyId, load: loadScope },
      orderBy: { createdAt: "desc" },
      include: { carrier: true, load: true }
    }),
    prisma.carrier.findMany({ where: { companyId: user.companyId }, orderBy: { name: "asc" } })
  ]);

  const openAr = invoices
    .filter((invoice) => invoice.status !== "PAID" && invoice.status !== "VOID")
    .reduce((sum, invoice) => sum + invoice.totalCents, 0);
  const openAp = carrierBills
    .filter((bill) => bill.status !== "PAID" && bill.status !== "VOID")
    .reduce((sum, bill) => sum + bill.totalCents, 0);
  const grossMargin = loads.reduce(
    (sum, load) => sum + load.revenueCents - load.carrierCostCents,
    0
  );

  return (
    <>
      <PageHeader
        title="Accounting"
        description="Manage customer invoices, carrier bills, gross margin, receivables, payables, and settlement readiness."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Open AR" value={formatMoney(openAr)} detail="Customer invoices outstanding" />
        <MetricCard label="Open AP" value={formatMoney(openAp)} detail="Carrier bills not yet paid" />
        <MetricCard label="Gross Margin" value={formatMoney(grossMargin)} detail="Revenue minus carrier cost" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="card overflow-hidden p-0">
          <div className="border-b border-border p-5">
            <h2 className="section-title">Customer Invoices</h2>
            <p className="muted">Invoices are tied directly to customer loads.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Load</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Due</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="font-semibold">{invoice.invoiceNo}</td>
                    <td>{invoice.load.loadNumber}</td>
                    <td>{invoice.customer.name}</td>
                    <td>
                      <StatusBadge value={invoice.status} />
                    </td>
                    <td>{formatMoney(invoice.totalCents)}</td>
                    <td>{formatDate(invoice.dueAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card overflow-hidden p-0">
          <div className="border-b border-border p-5">
            <h2 className="section-title">Carrier Bills</h2>
            <p className="muted">Track AP, quick pay, and settlement-style payables.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Bill</th>
                  <th>Load</th>
                  <th>Carrier</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Due</th>
                </tr>
              </thead>
              <tbody>
                {carrierBills.map((bill) => (
                  <tr key={bill.id}>
                    <td className="font-semibold">{bill.billNo}</td>
                    <td>{bill.load.loadNumber}</td>
                    <td>{bill.carrier.name}</td>
                    <td>
                      <StatusBadge value={bill.status} />
                    </td>
                    <td>{formatMoney(bill.totalCents)}</td>
                    <td>{formatDate(bill.dueAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="card">
          <h2 className="section-title">Generate Customer Invoice Document</h2>
          <p className="muted">Create a printable invoice from the selected load customer, lane, and charges.</p>
          <form action={generateCustomerInvoice} className="mt-4 grid gap-3">
            <select name="loadId" className="select" required>
              <option value="">Select load</option>
              {loads.map((load) => (
                <option key={load.id} value={load.id}>
                  {load.loadNumber} - {load.customer.name} - {formatMoney(load.revenueCents)}
                </option>
              ))}
            </select>
            <button type="submit" className="btn">
              Generate Printable Invoice
            </button>
          </form>
        </section>

        <section className="card">
          <h2 className="section-title">Create Invoice</h2>
          <form action={createInvoice} className="mt-4 grid gap-3">
            <input name="invoiceNo" className="input" placeholder="INV-1003" required />
            <select name="loadId" className="select" required>
              <option value="">Select load</option>
              {loads.map((load) => (
                <option key={load.id} value={load.id}>
                  {load.loadNumber} - {load.customer.name}
                </option>
              ))}
            </select>
            <select name="status" className="select" defaultValue="DRAFT">
              {paymentStatuses.map((status) => (
                <option key={status} value={status}>
                  {humanize(status)}
                </option>
              ))}
            </select>
            <div className="grid gap-3 md:grid-cols-3">
              <input name="total" className="input" placeholder="Total" required />
              <input name="issuedAt" className="input" type="date" />
              <input name="dueAt" className="input" type="date" />
            </div>
            <button type="submit" className="btn">
              Save Invoice
            </button>
          </form>
        </section>

        <section className="card">
          <h2 className="section-title">Create Carrier Bill</h2>
          <form action={createCarrierBill} className="mt-4 grid gap-3">
            <input name="billNo" className="input" placeholder="CB-1003" required />
            <select name="loadId" className="select" required>
              <option value="">Select load</option>
              {loads.map((load) => (
                <option key={load.id} value={load.id}>
                  {load.loadNumber} - {load.customer.name}
                </option>
              ))}
            </select>
            <select name="carrierId" className="select" required>
              <option value="">Select carrier</option>
              {carriers.map((carrier) => (
                <option key={carrier.id} value={carrier.id}>
                  {carrier.name}
                </option>
              ))}
            </select>
            <select name="status" className="select" defaultValue="DRAFT">
              {paymentStatuses.map((status) => (
                <option key={status} value={status}>
                  {humanize(status)}
                </option>
              ))}
            </select>
            <div className="grid gap-3 md:grid-cols-3">
              <input name="total" className="input" placeholder="Total" required />
              <input name="receivedAt" className="input" type="date" />
              <input name="dueAt" className="input" type="date" />
            </div>
            <button type="submit" className="btn">
              Save Carrier Bill
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
