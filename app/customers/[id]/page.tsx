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
import { requireTmsAccess, userHasPlanFeature } from "@/lib/permissions";
import { CUSTOMER_DETAIL_TILES } from "@/lib/tile-defaults";
import { canPickBranch, canWrite, isAdminRole } from "@/lib/scope";
import { toDocumentTableRows } from "@/lib/document-rows";
import { prisma } from "@/lib/db";
import { formatDateTime, formatMoney } from "@/lib/format";
import { formatLateFeePercent } from "@/lib/late-fees";
import {
  createCustomerPortalLink,
  disableCustomerPortalUser,
  inviteCustomerPortalUser,
  revokeCustomerPortalLink,
  updateCustomerPaymentUrl
} from "@/lib/portal-admin-actions";
import { loadPageLayoutContext } from "@/lib/ui-preferences-load";

export default async function CustomerDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    saved?: string;
    portalInvite?: string;
    portalLink?: string;
    error?: string;
  }>;
}) {
  const { id } = await params;
  const { saved, portalInvite, portalLink, error } = await searchParams;
  const user = await requireTmsAccess();
  const [customer, layoutContext, portalUsers, portalLinks] = await Promise.all([
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
    loadPageLayoutContext("customer-detail"),
    prisma.customerPortalUser.findMany({
      where: { customerId: id, companyId: user.companyId },
      orderBy: { createdAt: "desc" }
    }),
    prisma.customerPortalLink.findMany({
      where: { customerId: id, companyId: user.companyId },
      orderBy: { createdAt: "desc" }
    })
  ]);

  if (!customer || !(await canAccessRecord(user, customer.branchId))) {
    notFound();
  }

  const primaryContact = customer.contacts.find((contact) => contact.isPrimary) ?? customer.contacts[0];
  const openAr = customer.invoices
    .filter((invoice) => invoice.status !== "PAID" && invoice.status !== "VOID")
    .reduce((sum, invoice) => sum + invoice.totalCents, 0);
  const writable = canWrite(user);
  const canPortal = userHasPlanFeature(user, "customer_portal");
  const canCrmDocs = userHasPlanFeature(user, "crm_documents_activity");
  const customerTiles = CUSTOMER_DETAIL_TILES.filter((tile) => {
    if (tile.id === "portal") return canPortal;
    if (tile.id === "activity" || tile.id === "documents") return canCrmDocs;
    return true;
  });
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
        description="Customer profile, portal access, and customer-specific documents."
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

      {error ? (
        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
          {error}
        </div>
      ) : null}

      {portalInvite ? (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-semibold">Portal invite created</p>
          <p className="mt-1 break-all">{portalInvite}</p>
        </div>
      ) : null}

      {portalLink ? (
        <div className="mb-6 rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-900">
          <p className="font-semibold">Copy this magic link now (shown once)</p>
          <p className="mt-1 break-all">{portalLink}</p>
        </div>
      ) : null}

      <TileBoard
        pageId="customer-detail"
        tiles={customerTiles}
        initialLayouts={layoutContext.layouts}
        orgDefaultLayouts={layoutContext.orgDefaultLayouts}
        canSetOrgDefault={layoutContext.canSetOrgDefault}
      >
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

        {canPortal ? (
        <Tile id="portal">
          <p className="muted">
            Invite contacts to the customer portal or share a magic link. Portal users only see their
            loads — no carrier pay or margins.
          </p>

          {writable ? (
            <form action={updateCustomerPaymentUrl} className="mt-4 grid gap-3 rounded-2xl bg-muted p-4">
              <input type="hidden" name="customerId" value={customer.id} />
              <label className="grid gap-2">
                <span className="label">Payment URL override</span>
                <input
                  name="paymentUrl"
                  type="url"
                  className="input"
                  defaultValue={customer.paymentUrl ?? ""}
                  placeholder="Optional — falls back to company payment URL"
                />
              </label>
              <button type="submit" className="btn-secondary">
                Save payment URL
              </button>
            </form>
          ) : (
            <p className="mt-4 text-sm">
              Payment URL: {customer.paymentUrl?.trim() || "Using company default (if set)"}
            </p>
          )}

          {writable ? (
            <form action={inviteCustomerPortalUser} className="mt-4 grid gap-3 rounded-2xl bg-muted p-4">
              <input type="hidden" name="customerId" value={customer.id} />
              <p className="text-sm font-semibold">Invite portal user</p>
              <input name="name" className="input" placeholder="Contact name" required />
              <input name="email" type="email" className="input" placeholder="Email" required />
              <button type="submit" className="btn">
                Send invite
              </button>
            </form>
          ) : null}

          <div className="mt-4 grid gap-2">
            <p className="text-sm font-semibold">Portal users</p>
            {portalUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No portal users yet.</p>
            ) : (
              portalUsers.map((portalUser) => (
                <div
                  key={portalUser.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-3 text-sm"
                >
                  <div>
                    <p className="font-semibold">{portalUser.name}</p>
                    <p className="muted">
                      {portalUser.email} · {portalUser.status}
                    </p>
                  </div>
                  {writable && portalUser.status !== "DISABLED" ? (
                    <form action={disableCustomerPortalUser}>
                      <input type="hidden" name="customerId" value={customer.id} />
                      <input type="hidden" name="portalUserId" value={portalUser.id} />
                      <button type="submit" className="btn-secondary">
                        Disable
                      </button>
                    </form>
                  ) : null}
                </div>
              ))
            )}
          </div>

          {writable ? (
            <form action={createCustomerPortalLink} className="mt-4 grid gap-3 rounded-2xl bg-muted p-4">
              <input type="hidden" name="customerId" value={customer.id} />
              <p className="text-sm font-semibold">Create magic link</p>
              <input name="label" className="input" placeholder="Label" defaultValue="Share link" />
              <label className="grid gap-2">
                <span className="label">Expires in days</span>
                <input
                  name="expiresInDays"
                  type="number"
                  min={1}
                  max={365}
                  className="input"
                  defaultValue={30}
                />
              </label>
              <button type="submit" className="btn-secondary">
                Create link
              </button>
            </form>
          ) : null}

          <div className="mt-4 grid gap-2">
            <p className="text-sm font-semibold">Magic links</p>
            {portalLinks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No share links yet.</p>
            ) : (
              portalLinks.map((link) => (
                <div
                  key={link.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-3 text-sm"
                >
                  <div>
                    <p className="font-semibold">{link.label}</p>
                    <p className="muted">
                      {link.revokedAt
                        ? "Revoked"
                        : link.expiresAt
                          ? `Expires ${formatDateTime(link.expiresAt)}`
                          : "No expiry"}
                    </p>
                  </div>
                  {writable && !link.revokedAt ? (
                    <form action={revokeCustomerPortalLink}>
                      <input type="hidden" name="customerId" value={customer.id} />
                      <input type="hidden" name="linkId" value={link.id} />
                      <button type="submit" className="btn-secondary">
                        Revoke
                      </button>
                    </form>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </Tile>
        ) : null}

        {canCrmDocs ? (
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
        ) : null}

        {canCrmDocs ? (
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
        ) : null}
      </TileBoard>
    </>
  );
}
