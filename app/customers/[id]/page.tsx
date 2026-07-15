import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentUploadForm } from "@/components/document-upload-form";
import { DocumentsTable } from "@/components/documents-table";
import { PageHeader } from "@/components/page-header";
import { TileBoard, Tile } from "@/components/tile-board";
import {
  addCustomerActivityNote,
  updateCustomer,
  updateCustomerRateConfirmationTerms
} from "@/lib/actions";
import { canAccessRecord } from "@/lib/branch-filter-server";
import { requireTmsAccess } from "@/lib/permissions";
import { canPickBranch, canWrite, isAdminRole } from "@/lib/scope";
import { toDocumentTableRows } from "@/lib/document-rows";
import { prisma } from "@/lib/db";
import { formatDateTime, formatMoney } from "@/lib/format";
import { formatLateFeePercent } from "@/lib/late-fees";
import { CUSTOMER_DETAIL_TILES } from "@/lib/tile-defaults";
import { loadPageLayouts } from "@/lib/ui-preferences-load";

export default async function CustomerDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const { saved } = await searchParams;
  const user = await requireTmsAccess();
  const [customer, layouts] = await Promise.all([
    prisma.customer.findUnique({
      where: { id, companyId: user.companyId },
      include: {
        branch: true,
        contacts: true,
        loads: { select: { id: true } },
        invoices: true,
        documents: { include: { uploadedBy: true, load: true, customer: true, carrier: true } },
        activities: { orderBy: { createdAt: "desc" }, include: { user: true } }
      }
    }),
    loadPageLayouts("customer-detail")
  ]);

  if (!customer || !(await canAccessRecord(user, customer.branchId))) {
    notFound();
  }

  const primaryContact = customer.contacts.find((contact) => contact.isPrimary) ?? customer.contacts[0];
  const openAr = customer.invoices
    .filter((invoice) => invoice.status !== "PAID" && invoice.status !== "VOID")
    .reduce((sum, invoice) => sum + invoice.totalCents, 0);
  const writable = canWrite(user);
  const showBranchPicker = canPickBranch(user);
  const branches = showBranchPicker
    ? await prisma.branch.findMany({
        where: {
          companyId: user.companyId,
          ...(isAdminRole(user.role) ? {} : { id: { in: user.branchIds } })
        },
        orderBy: { name: "asc" }
      })
    : [];

  return (
    <>
      <PageHeader
        title={customer.name}
        description="Customer profile, account summary, and customer-specific documents."
        action={
          <Link href="/customers" className="btn-secondary">
            Back to customers
          </Link>
        }
      />

      {saved ? (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          Customer saved successfully.
        </div>
      ) : null}

      <TileBoard pageId="customer-detail" tiles={CUSTOMER_DETAIL_TILES} initialLayouts={layouts}>
        <Tile id="profile">
          {writable ? (
            <form action={updateCustomer} className="grid gap-3">
              <input type="hidden" name="customerId" value={customer.id} />
              <input name="name" className="input" defaultValue={customer.name} required />
              <input name="address" className="input" defaultValue={customer.address ?? ""} placeholder="Address" />
              <div className="grid gap-3 md:grid-cols-3">
                <input name="city" className="input" defaultValue={customer.city ?? ""} placeholder="City" />
                <input
                  name="state"
                  className="input"
                  defaultValue={customer.state ?? ""}
                  placeholder="State"
                  maxLength={2}
                />
                <input
                  name="postalCode"
                  className="input"
                  defaultValue={customer.postalCode ?? ""}
                  placeholder="Zip"
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <input name="phone" className="input" defaultValue={customer.phone ?? ""} placeholder="Main phone" />
                <input
                  name="email"
                  className="input"
                  defaultValue={customer.email ?? ""}
                  placeholder="Main email"
                  type="email"
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  name="industry"
                  className="input"
                  defaultValue={customer.industry ?? ""}
                  placeholder="Industry"
                />
                <select name="status" className="select" defaultValue={customer.status}>
                  <option>Active</option>
                  <option>Prospect</option>
                  <option>Credit Hold</option>
                  <option>Inactive</option>
                </select>
              </div>
              {showBranchPicker ? (
                <label className="grid gap-2">
                  <span className="label">Branch</span>
                  <select name="branchId" className="select" defaultValue={customer.branchId ?? ""}>
                    <option value="">Unassigned</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <div className="grid gap-3 md:grid-cols-3">
                <input
                  name="creditLimit"
                  className="input"
                  defaultValue={String(customer.creditLimit / 100)}
                  placeholder="Credit limit"
                />
                <input
                  name="paymentTerms"
                  className="input"
                  defaultValue={customer.paymentTerms}
                  placeholder="Payment terms"
                />
                <input
                  name="lateFeePercent"
                  className="input"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  defaultValue={String(customer.lateFeePercent)}
                  placeholder="Late fee %"
                />
              </div>
              <div className="rounded-2xl bg-muted p-4">
                <p className="mb-3 text-sm font-semibold text-foreground">Primary Contact</p>
                <div className="grid gap-3">
                  <input
                    name="contactName"
                    className="input"
                    defaultValue={primaryContact?.name ?? ""}
                    placeholder="Contact name"
                  />
                  <input
                    name="contactTitle"
                    className="input"
                    defaultValue={primaryContact?.title ?? ""}
                    placeholder="Title"
                  />
                  <input
                    name="contactEmail"
                    className="input"
                    defaultValue={primaryContact?.email ?? ""}
                    placeholder="Email"
                    type="email"
                  />
                  <input
                    name="contactPhone"
                    className="input"
                    defaultValue={primaryContact?.phone ?? ""}
                    placeholder="Phone"
                  />
                </div>
              </div>
              <div className="grid gap-3 rounded-2xl bg-muted p-4 text-sm">
                <div>
                  <p className="label">Loads / Open AR</p>
                  <p className="font-semibold text-foreground">
                    {customer.loads.length} loads - {formatMoney(openAr)} open AR
                  </p>
                </div>
              </div>
              <button className="btn" type="submit">
                Save Customer
              </button>
            </form>
          ) : (
            <div className="grid gap-3 rounded-2xl bg-muted p-4 text-sm">
              <div>
                <p className="label">Location</p>
                <p className="font-semibold text-foreground">
                  {customer.city ?? "No city"}, {customer.state ?? "No state"}
                </p>
              </div>
              <div>
                <p className="label">Branch</p>
                <p className="font-semibold text-foreground">{customer.branch?.name ?? "Unassigned"}</p>
              </div>
              <div>
                <p className="label">Primary Contact</p>
                <p className="font-semibold text-foreground">{primaryContact?.name ?? "No contact"}</p>
                <p className="muted">{primaryContact?.email ?? customer.email ?? "No email"}</p>
              </div>
              <div>
                <p className="label">Payment Terms</p>
                <p className="font-semibold text-foreground">{customer.paymentTerms}</p>
              </div>
              <div>
                <p className="label">Credit Limit</p>
                <p className="font-semibold text-foreground">{formatMoney(customer.creditLimit)}</p>
              </div>
              <div>
                <p className="label">Late Fee %</p>
                <p className="font-semibold text-foreground">{formatLateFeePercent(customer.lateFeePercent)}</p>
              </div>
              <div>
                <p className="label">Loads / Open AR</p>
                <p className="font-semibold text-foreground">
                  {customer.loads.length} loads - {formatMoney(openAr)} open AR
                </p>
              </div>
            </div>
          )}
        </Tile>

        <Tile id="rate-terms">
          <p className="muted">
            Default terms appended to built-in rate confirmation language for this customer&apos;s
            loads. Individual loads can override.
          </p>
          {writable ? (
            <form action={updateCustomerRateConfirmationTerms} className="mt-4 grid gap-3">
              <input type="hidden" name="customerId" value={customer.id} />
              <textarea
                name="rateConfirmationTerms"
                className="textarea"
                rows={6}
                defaultValue={customer.rateConfirmationTerms ?? ""}
                placeholder="Check-in procedures, failure-to-comply rules, appointment requirements…"
              />
              <button type="submit" className="btn-secondary">
                Save Terms
              </button>
            </form>
          ) : (
            <p className="mt-4 whitespace-pre-wrap rounded-2xl bg-muted p-4 text-sm text-slate-700">
              {customer.rateConfirmationTerms?.trim() || "No custom rate confirmation terms set."}
            </p>
          )}
        </Tile>

        <Tile id="activity">
          {writable ? (
            <form action={addCustomerActivityNote} className="grid gap-3 rounded-2xl bg-muted p-4">
              <input type="hidden" name="customerId" value={customer.id} />
              <textarea
                name="body"
                className="textarea"
                rows={3}
                placeholder="Add a note to the activity log…"
                required
              />
              <button type="submit" className="btn-secondary">
                Save Activity Note
              </button>
            </form>
          ) : null}
          <div className={writable ? "mt-4 grid gap-3" : "grid gap-3"}>
            {customer.activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              customer.activities.map((activity) => (
                <div key={activity.id} className="rounded-2xl border border-border p-3">
                  <p className="font-semibold text-foreground">{activity.action}</p>
                  <p className="muted whitespace-pre-wrap">{activity.details ?? "No details"}</p>
                  <p className="text-xs text-muted-foreground">
                    {activity.user?.name ? `${activity.user.name} · ` : ""}
                    {formatDateTime(activity.createdAt)}
                  </p>
                </div>
              ))
            )}
          </div>
        </Tile>

        <Tile id="documents">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <p className="muted">Upload contracts, credit applications, and other customer-specific paperwork.</p>
            <Link href="/documents/new" className="btn-secondary">
              Upload in document library
            </Link>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-border">
            <DocumentsTable
              documents={toDocumentTableRows(customer.documents)}
              showFilter={false}
              compact
            />
          </div>

          <div className="mt-5 rounded-2xl bg-muted p-4">
            <p className="mb-3 text-sm font-semibold text-foreground">Upload Customer Document</p>
            <DocumentUploadForm
              defaultCustomerId={customer.id}
              showEntityPickers={false}
              submitLabel="Add Document"
            />
          </div>
        </Tile>
      </TileBoard>
    </>
  );
}
