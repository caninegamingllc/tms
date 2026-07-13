import { notFound } from "next/navigation";
import { DocumentUploadForm } from "@/components/document-upload-form";
import { DocumentsTable } from "@/components/documents-table";
import { PageHeader } from "@/components/page-header";
import { LoadRoutePanel } from "@/components/load-route-panel";
import { SearchCombobox } from "@/components/search-combobox";
import { StatusBadge } from "@/components/status-badge";
import {
  addCheckCall,
  assignCarrier,
  generateBillOfLading,
  generateCustomerInvoice,
  generateRateConfirmation,
  updateLoadStatus
} from "@/lib/actions";
import {
  emailCustomerLoadConfirmation,
  emailInvoice,
  emailPodRequest,
  emailRateConfirmation,
  generateCustomerLoadConfirmation,
  syncLoadEmails
} from "@/lib/email-ops-actions";
import { getUserMailbox } from "@/lib/mail/user-mailbox";
import { DeleteLoadButton } from "@/components/delete-load-button";
import {
  addLoadExpense,
  assignLoadCommissionProfile,
  removeLoadExpense,
  settleLoadCommission,
  updateLoadCommissionable
} from "@/lib/commission-actions";
import { recalculateLoadCommission } from "@/lib/commission";
import { toDocumentTableRows } from "@/lib/document-rows";
import { requireTmsAccess } from "@/lib/permissions";
import { canAccessRecord, getBranchScope } from "@/lib/branch-filter-server";
import { canManageUsers, canSettleCommission, canWrite } from "@/lib/scope";
import { expenseTypes, loadStatuses } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { commissionMethodLabel, formatDate, formatDateTime, formatMoney, humanize, marginPercent } from "@/lib/format";
import {
  pushCarrierBillToQuickbooksAction,
  pushInvoiceToQuickbooksAction
} from "@/lib/quickbooks/actions";
import {
  getCompanyQuickbooksMethod,
  getExportsForEntities,
  toExportStatusView
} from "@/lib/quickbooks/exports";
import type { AccountingExportMethod } from "@/lib/quickbooks/types";

export default async function LoadDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ emailed?: string }>;
}) {
  const { id } = await params;
  const { emailed } = await searchParams;
  const user = await requireTmsAccess();
  const [load, carriers, commissionProfiles, mailbox] = await Promise.all([
    prisma.load.findUnique({
      where: { id, companyId: user.companyId },
      include: {
        customer: { include: { contacts: true } },
        branch: true,
        stops: { orderBy: { sequence: "asc" } },
        charges: true,
        expenses: true,
        commission: true,
        documents: { include: { uploadedBy: true, load: true, customer: true, carrier: true } },
        notes: { orderBy: { createdAt: "desc" }, include: { user: true } },
        activities: { orderBy: { createdAt: "desc" }, include: { user: true } },
        emailThreads: {
          orderBy: { updatedAt: "desc" },
          include: {
            messages: { orderBy: { createdAt: "asc" } },
            user: true
          }
        },
        dispatchAssignment: {
          include: {
            carrier: { include: { contacts: true } },
            checkCalls: { orderBy: { occurredAt: "desc" } }
          }
        },
        invoices: true,
        carrierBills: { include: { carrier: true } }
      }
    }),
    prisma.carrier.findMany({ where: await getBranchScope(user), orderBy: { name: "asc" } }),
    canManageUsers(user)
      ? prisma.commissionProfile.findMany({
          where: { companyId: user.companyId },
          orderBy: { name: "asc" }
        })
      : Promise.resolve([]),
    getUserMailbox(user.id)
  ]);

  if (!load || !(await canAccessRecord(user, load.branchId))) {
    notFound();
  }

  const quickbooksMethod = await getCompanyQuickbooksMethod(user.companyId);
  const activeExportMethod: AccountingExportMethod | null =
    quickbooksMethod === "ONLINE" || quickbooksMethod === "IIF" ? quickbooksMethod : null;
  const qboAccount = await prisma.integrationAccount.findUnique({
    where: {
      companyId_provider: { companyId: user.companyId, provider: "QUICKBOOKS" }
    }
  });
  const canPushOnline = quickbooksMethod === "ONLINE" && qboAccount?.status === "Connected" && canWrite(user);

  const [invoiceExports, billExports] = await Promise.all([
    activeExportMethod
      ? getExportsForEntities({
          companyId: user.companyId,
          method: activeExportMethod,
          entityType: "INVOICE",
          entityIds: load.invoices.map((invoice) => invoice.id)
        })
      : Promise.resolve(new Map()),
    activeExportMethod
      ? getExportsForEntities({
          companyId: user.companyId,
          method: activeExportMethod,
          entityType: "CARRIER_BILL",
          entityIds: load.carrierBills.map((bill) => bill.id)
        })
      : Promise.resolve(new Map())
  ]);

  if (!load.commission) {
    await recalculateLoadCommission(load.id);
    const refreshed = await prisma.load.findUnique({
      where: { id },
      include: { commission: true, expenses: true }
    });
    if (refreshed?.commission) {
      load.commission = refreshed.commission;
    }
    if (refreshed?.expenses) {
      load.expenses = refreshed.expenses;
    }
  }

  const carrierOptions = carriers.map((carrier) => ({
    id: carrier.id,
    label: carrier.name,
    description: [
      carrier.mcNumber,
      carrier.dotNumber,
      carrier.complianceStatus,
      carrier.insuranceExpiresAt ? `Insurance ${formatDate(carrier.insuranceExpiresAt)}` : "Insurance missing"
    ]
      .filter(Boolean)
      .join(" - ")
  }));

  return (
    <>
      <PageHeader
        title={`${load.loadNumber}: ${load.title}`}
        description={`${load.customer.name} freight from ${load.pickupCity}, ${load.pickupState} to ${load.deliveryCity}, ${load.deliveryState}.`}
        action={
          canWrite(user) ? (
            <DeleteLoadButton loadId={load.id} loadNumber={load.loadNumber} />
          ) : undefined
        }
      />

      {emailed ? (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
          Email sent ({humanize(emailed.replace(/-/g, "_"))}).
        </div>
      ) : null}

      {!mailbox ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Connect your mailbox in{" "}
          <a href="/settings/email" className="font-semibold underline">
            Email settings
          </a>{" "}
          to send rate confirmations, invoices, load confirmations, and POD requests as yourself.
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.9fr]">
        <div className="grid gap-6">
          <section className="card">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <StatusBadge value={load.status} />
                <h2 className="mt-3 text-2xl font-bold text-foreground">{load.title}</h2>
                <p className="muted">
                  {load.equipmentType} - {load.commodity ?? "General freight"} -{" "}
                  {load.weight ? `${load.weight.toLocaleString()} lbs` : "Weight TBD"}
                </p>
              </div>
              <div className="grid gap-1 text-right">
                <span className="text-sm text-muted-foreground">Gross margin</span>
                <span className="text-2xl font-bold text-foreground">
                  {formatMoney(load.revenueCents - load.carrierCostCents)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {marginPercent(load.revenueCents, load.carrierCostCents)}
                </span>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-muted p-4">
                <p className="label">Customer Rate</p>
                <p className="mt-2 text-xl font-semibold">{formatMoney(load.revenueCents)}</p>
              </div>
              <div className="rounded-2xl bg-muted p-4">
                <p className="label">Carrier Cost</p>
                <p className="mt-2 text-xl font-semibold">{formatMoney(load.carrierCostCents)}</p>
              </div>
              <div className="rounded-2xl bg-muted p-4">
                <p className="label">Reference</p>
                <p className="mt-2 text-xl font-semibold">{load.referenceNumber ?? "None"}</p>
              </div>
            </div>
          </section>

          <section className="card">
            <h2 className="section-title">Stops</h2>
            <div className="mt-4 grid gap-3">
              {load.stops.map((stop) => (
                <div key={stop.id} className="rounded-2xl border border-border p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-foreground">
                        {stop.sequence}. {humanize(stop.type)} - {stop.facilityName}
                      </p>
                      <p className="muted">
                        {stop.city}, {stop.state}
                      </p>
                    </div>
                    <span className="text-sm text-muted-foreground">{formatDateTime(stop.appointmentAt)}</span>
                  </div>
                  {stop.instructions ? (
                    <p className="mt-3 rounded-xl bg-muted p-3 text-sm text-slate-700">
                      {stop.instructions}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
            <LoadRoutePanel loadId={load.id} />
          </section>

          <section className="card">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="section-title">Documents</h2>
                <p className="muted">Generate printable carrier, shipper, and customer paperwork.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <form action={generateRateConfirmation}>
                  <input type="hidden" name="loadId" value={load.id} />
                  <button className="btn-secondary" type="submit" disabled={!load.dispatchAssignment}>
                    Generate Rate Con
                  </button>
                </form>
                <form action={generateCustomerLoadConfirmation}>
                  <input type="hidden" name="loadId" value={load.id} />
                  <button className="btn-secondary" type="submit">
                    Generate Load Con
                  </button>
                </form>
                <form action={generateBillOfLading}>
                  <input type="hidden" name="loadId" value={load.id} />
                  <button className="btn-secondary" type="submit">
                    Generate BOL
                  </button>
                </form>
                <form action={generateCustomerInvoice}>
                  <input type="hidden" name="loadId" value={load.id} />
                  <button className="btn-secondary" type="submit">
                    Generate Invoice
                  </button>
                </form>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <form action={emailRateConfirmation}>
                <input type="hidden" name="loadId" value={load.id} />
                <button
                  className="btn"
                  type="submit"
                  disabled={!mailbox || !load.dispatchAssignment || !canWrite(user)}
                >
                  Email Rate Con
                </button>
              </form>
              <form action={emailCustomerLoadConfirmation}>
                <input type="hidden" name="loadId" value={load.id} />
                <button className="btn" type="submit" disabled={!mailbox || !canWrite(user)}>
                  Email Load Con
                </button>
              </form>
              <form action={emailInvoice}>
                <input type="hidden" name="loadId" value={load.id} />
                <button className="btn" type="submit" disabled={!mailbox || !canWrite(user)}>
                  Email Invoice
                </button>
              </form>
              <form action={emailPodRequest}>
                <input type="hidden" name="loadId" value={load.id} />
                <button
                  className="btn"
                  type="submit"
                  disabled={!mailbox || !load.dispatchAssignment || !canWrite(user)}
                >
                  Email POD Request
                </button>
              </form>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-border">
              <DocumentsTable
                documents={toDocumentTableRows(load.documents)}
                showFilter={false}
                compact
              />
            </div>

            <div className="mt-5 rounded-2xl bg-muted p-4">
              <p className="mb-3 text-sm font-semibold text-foreground">Upload Load Document</p>
              <DocumentUploadForm
                defaultLoadId={load.id}
                defaultCustomerId={load.customerId}
                defaultCarrierId={load.dispatchAssignment?.carrierId}
                showEntityPickers={false}
                submitLabel="Add Document"
              />
            </div>
          </section>

          <section className="card">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="section-title">Email</h2>
                <p className="muted">Outbound and reply threads for this load.</p>
              </div>
              <form action={syncLoadEmails}>
                <input type="hidden" name="loadId" value={load.id} />
                <button type="submit" className="btn-secondary" disabled={!mailbox}>
                  Sync replies
                </button>
              </form>
            </div>
            <div className="mt-4 grid gap-3">
              {load.emailThreads.length === 0 ? (
                <p className="text-sm text-muted-foreground">No emails sent for this load yet.</p>
              ) : (
                load.emailThreads.map((thread) => (
                  <div key={thread.id} className="rounded-2xl border border-border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-foreground">{thread.subject}</p>
                        <p className="text-sm text-muted-foreground">
                          {humanize(thread.purpose)} · {humanize(thread.provider)} · {thread.user.name}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">{formatDateTime(thread.updatedAt)}</p>
                    </div>
                    <div className="mt-3 grid gap-2">
                      {thread.messages.map((message) => (
                        <div key={message.id} className="rounded-xl bg-muted p-3 text-sm">
                          <p className="font-semibold">
                            {humanize(message.direction)} · {message.fromAddress} → {message.toAddresses}
                          </p>
                          <p className="mt-1 text-slate-700">
                            {message.bodyPreview || message.subject}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDateTime(message.sentAt ?? message.receivedAt ?? message.createdAt)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <aside className="grid gap-6">
          <section className="card">
            <h2 className="section-title">Workflow</h2>
            <form action={updateLoadStatus} className="mt-4 grid gap-3">
              <input type="hidden" name="loadId" value={load.id} />
              <select name="status" className="select" defaultValue={load.status}>
                {loadStatuses.map((status) => (
                  <option key={status} value={status}>
                    {humanize(status)}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn">
                Update Status
              </button>
            </form>
          </section>

          <section className="card">
            <h2 className="section-title">Carrier Assignment</h2>
            <p className="muted">
              Current carrier: {load.dispatchAssignment?.carrier.name ?? "Not covered"}
            </p>
            <form action={assignCarrier} className="mt-4 grid gap-3">
              <input type="hidden" name="loadId" value={load.id} />
              <SearchCombobox
                name="carrierId"
                label="Carrier"
                placeholder="Search carriers"
                options={carrierOptions}
                defaultValue={load.dispatchAssignment?.carrierId ?? ""}
                required
              />
              <input
                name="rate"
                className="input"
                defaultValue={load.dispatchAssignment ? load.dispatchAssignment.rateCents / 100 : ""}
                placeholder="Carrier rate"
                required
              />
              <input name="driverName" className="input" placeholder="Driver name" defaultValue={load.dispatchAssignment?.driverName ?? ""} />
              <input name="driverPhone" className="input" placeholder="Driver phone" defaultValue={load.dispatchAssignment?.driverPhone ?? ""} />
              <div className="grid gap-3 md:grid-cols-2">
                <input name="truckNumber" className="input" placeholder="Truck #" defaultValue={load.dispatchAssignment?.truckNumber ?? ""} />
                <input name="trailerNumber" className="input" placeholder="Trailer #" defaultValue={load.dispatchAssignment?.trailerNumber ?? ""} />
              </div>
              <button type="submit" className="btn">
                Save Assignment
              </button>
            </form>
          </section>

          {load.dispatchAssignment ? (
            <section className="card">
              <h2 className="section-title">Check Calls</h2>
              <div className="mt-4 grid gap-3">
                {load.dispatchAssignment.checkCalls.map((call) => (
                  <div key={call.id} className="rounded-2xl border border-border p-3">
                    <p className="font-semibold text-foreground">{call.status}</p>
                    <p className="muted">{call.location}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(call.occurredAt)}</p>
                    {call.notes ? <p className="mt-2 text-sm text-slate-700">{call.notes}</p> : null}
                  </div>
                ))}
              </div>
              <form action={addCheckCall} className="mt-4 grid gap-3 rounded-2xl bg-muted p-4">
                <input type="hidden" name="assignmentId" value={load.dispatchAssignment.id} />
                <input type="hidden" name="loadId" value={load.id} />
                <input name="location" className="input" placeholder="Location" required />
                <input name="status" className="input" placeholder="Status update" required />
                <textarea name="notes" className="textarea" placeholder="Notes" rows={3} />
                <input name="nextCheckAt" className="input" type="datetime-local" />
                <button className="btn" type="submit">
                  Add Check Call
                </button>
              </form>
            </section>
          ) : null}

          <section className="card">
            <h2 className="section-title">Commission</h2>
            <p className="muted">
              Branch: {load.branch?.name ?? "Unassigned"} — payable once the customer has paid.
            </p>

            <form action={updateLoadCommissionable} className="mt-4 flex items-center gap-2">
              <input type="hidden" name="loadId" value={load.id} />
              <input type="hidden" name="isCommissionable" value={load.isCommissionable ? "false" : "true"} />
              <button type="submit" className="btn-secondary">
                Mark {load.isCommissionable ? "Non-Commissionable" : "Commissionable"}
              </button>
              <span className="text-sm text-muted-foreground">
                Currently {load.isCommissionable ? "commissionable" : "non-commissionable"}
              </span>
            </form>

            {canManageUsers(user) ? (
              <form action={assignLoadCommissionProfile} className="mt-4 grid gap-3">
                <input type="hidden" name="loadId" value={load.id} />
                <label className="grid gap-2">
                  <span className="label">Commission Profile Override</span>
                  <select name="profileId" className="select" defaultValue={load.commissionProfileId ?? ""}>
                    <option value="">Use branch/company default</option>
                    {commissionProfiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="btn-secondary">
                  Save Profile
                </button>
              </form>
            ) : null}

            {load.commission ? (
              <div className="mt-4 grid gap-3 rounded-2xl bg-muted p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-foreground">Calculation Breakdown</p>
                  <StatusBadge value={load.commission.status} />
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <p>Revenue: {formatMoney(load.commission.revenueCents)}</p>
                  <p>Gross expenses: {formatMoney(load.commission.grossExpenseCents)}</p>
                  <p>Gross profit: {formatMoney(load.commission.grossProfitCents)}</p>
                  <p>Profile: {load.commission.profileName}</p>
                  <p>Branch commission: {formatMoney(load.commission.branchShareCents)}</p>
                  <p>Company share: {formatMoney(load.commission.companyShareCents)}</p>
                  <p>Method: {commissionMethodLabel(load.commission.calculationMethod)}</p>
                  <p>Carrier cost: {formatMoney(load.carrierCostCents)}</p>
                  <p>
                    Other expenses:{" "}
                    {formatMoney(load.commission.grossExpenseCents - load.carrierCostCents)}
                  </p>
                </div>
                {load.commission.status === "PAYABLE" && canSettleCommission(user) ? (
                  <form action={settleLoadCommission}>
                    <input type="hidden" name="loadId" value={load.id} />
                    <button type="submit" className="btn">
                      Mark Commission Settled
                    </button>
                  </form>
                ) : null}
              </div>
            ) : null}

            <div className="mt-4 grid gap-3">
              <h3 className="font-semibold text-foreground">Load Expenses</h3>
              {load.expenses.map((expense) => (
                <div key={expense.id} className="flex items-center justify-between rounded-2xl border border-border p-3">
                  <div>
                    <p className="font-semibold">{expense.label}</p>
                    <p className="muted">
                      {expense.expenseType} - {formatMoney(expense.amountCents)}
                    </p>
                  </div>
                  <form action={removeLoadExpense}>
                    <input type="hidden" name="expenseId" value={expense.id} />
                    <input type="hidden" name="loadId" value={load.id} />
                    <button type="submit" className="btn-secondary">
                      Remove
                    </button>
                  </form>
                </div>
              ))}
            </div>

            <form action={addLoadExpense} className="mt-4 grid gap-3 rounded-2xl bg-muted p-4">
              <input type="hidden" name="loadId" value={load.id} />
              <input name="label" className="input" placeholder="Expense label" required />
              <select name="expenseType" className="select" defaultValue="Other">
                {expenseTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <input name="amount" className="input" placeholder="Amount" required />
              <button type="submit" className="btn">
                Add Expense
              </button>
            </form>
          </section>

          <section className="card">
            <h2 className="section-title">Accounting</h2>
            <div className="mt-4 grid gap-3">
              {load.invoices.map((invoice) => {
                const exportView =
                  activeExportMethod != null
                    ? toExportStatusView(activeExportMethod, invoiceExports.get(invoice.id) ?? null)
                    : null;
                return (
                  <div key={invoice.id} className="rounded-2xl bg-muted p-3">
                    <p className="font-semibold">{invoice.invoiceNo}</p>
                    <p className="muted">
                      {formatMoney(invoice.totalCents)} - {humanize(invoice.status)}
                    </p>
                    {exportView ? <p className="mt-1 text-sm text-slate-700">{exportView.label}</p> : null}
                    {canPushOnline ? (
                      <form action={pushInvoiceToQuickbooksAction} className="mt-2">
                        <input type="hidden" name="invoiceId" value={invoice.id} />
                        <button type="submit" className="btn-secondary">
                          Push to QuickBooks
                        </button>
                      </form>
                    ) : null}
                  </div>
                );
              })}
              {load.carrierBills.map((bill) => {
                const exportView =
                  activeExportMethod != null
                    ? toExportStatusView(activeExportMethod, billExports.get(bill.id) ?? null)
                    : null;
                return (
                  <div key={bill.id} className="rounded-2xl bg-muted p-3">
                    <p className="font-semibold">{bill.billNo}</p>
                    <p className="muted">
                      {bill.carrier.name} - {formatMoney(bill.totalCents)} - {humanize(bill.status)}
                    </p>
                    {exportView ? <p className="mt-1 text-sm text-slate-700">{exportView.label}</p> : null}
                    {canPushOnline ? (
                      <form action={pushCarrierBillToQuickbooksAction} className="mt-2">
                        <input type="hidden" name="billId" value={bill.id} />
                        <button type="submit" className="btn-secondary">
                          Push to QuickBooks
                        </button>
                      </form>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="card">
            <h2 className="section-title">Activity Log</h2>
            <div className="mt-4 grid gap-3">
              {load.activities.map((activity) => (
                <div key={activity.id} className="rounded-2xl border border-border p-3">
                  <p className="font-semibold text-foreground">{activity.action}</p>
                  <p className="muted">{activity.details ?? "No details"}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(activity.createdAt)}</p>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
