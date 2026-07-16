import { notFound } from "next/navigation";
import { after } from "next/server";
import { DocumentUploadForm } from "@/components/document-upload-form";
import { DocumentsTable } from "@/components/documents-table";
import { PageHeader } from "@/components/page-header";
import { LoadRoutePanel } from "@/components/load-route-panel";
import { CheckCallForm } from "@/components/check-call-location-input";
import { CarrierAssignmentsPanel } from "@/components/carrier-assignments-panel";
import { LoadDetailsEditor } from "@/components/load-details-editor";
import { StatusBadge } from "@/components/status-badge";
import { Tile, TileBoard } from "@/components/tile-board";
import { LOAD_DETAIL_TILES } from "@/lib/tile-defaults";
import { loadPageLayouts } from "@/lib/ui-preferences-load";
import {
  addCheckCall,
  addLoadActivityNote,
  addLoadNote,
  generateBillOfLading,
  generateCustomerInvoice,
  generateRateConfirmation,
  updateLoadRateConfirmationTerms,
  updateLoadStatus
} from "@/lib/actions";
import {
  generateCustomerLoadConfirmation,
  syncLoadEmails
} from "@/lib/email-ops-actions";
import { EmailComposeButton } from "@/components/email-compose-button";
import { getUserMailbox } from "@/lib/mail/user-mailbox";
import { CloneLoadButton } from "@/components/clone-load-button";
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
import { requireTmsAccess, userHasPlanFeature } from "@/lib/permissions";
import { canAccessRecord, getBranchScope } from "@/lib/branch-filter-server";
import { canManageUsers, canPickBranch, canSettleCommission, canWrite, isAdminRole } from "@/lib/scope";
import { expenseTypes, loadStatuses } from "@/lib/constants";
import { ensureCompanyCatalogs } from "@/lib/catalogs";
import { prisma } from "@/lib/db";
import { carrierDisplayName, primaryAssignment } from "@/lib/dispatch-assignment";
import { commissionMethodLabel, formatDate, formatDateTime, formatMoney, humanize, marginPercent } from "@/lib/format";
import { isPrivateLoadNote } from "@/lib/document-templates";
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
import { FleetAssignmentPanel } from "@/components/fleet-assignment-panel";
import { driverDisplayName } from "@/lib/fleet-constants";
import { planHasFeature } from "@/lib/plans";

export default async function LoadDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ emailed?: string; saved?: string; error?: string }>;
}) {
  const { id } = await params;
  const { emailed, saved, error } = await searchParams;
  const user = await requireTmsAccess();
  after(() => {
    void ensureCompanyCatalogs(user.companyId);
  });
  const scope = await getBranchScope(user);
  const [
    load,
    carriers,
    commissionProfiles,
    mailbox,
    payLineTypes,
    layouts,
    customers,
    facilities,
    branches,
    commodities,
    chargeTypes
  ] = await Promise.all([
    prisma.load.findUnique({
      where: { id, companyId: user.companyId },
      include: {
        customer: { include: { contacts: true } },
        branch: true,
        stops: { orderBy: { sequence: "asc" } },
        commodityLines: { orderBy: { sequence: "asc" } },
        charges: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        expenses: true,
        carrierPayLines: {
          orderBy: { sortOrder: "asc" },
          include: { lineType: true }
        },
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
        dispatchAssignments: {
          orderBy: { sequence: "asc" },
          include: {
            carrier: { include: { contacts: true } },
            driver: true,
            truck: true,
            trailer: true,
            payLines: {
              orderBy: { sortOrder: "asc" },
              include: { lineType: true }
            },
            checkCalls: { orderBy: { occurredAt: "desc" } }
          }
        },
        invoices: true,
        carrierBills: { include: { carrier: true } }
      }
    }),
    prisma.carrier.findMany({ where: scope, orderBy: { name: "asc" } }),
    canManageUsers(user)
      ? prisma.commissionProfile.findMany({
          where: { companyId: user.companyId },
          orderBy: { name: "asc" }
        })
      : Promise.resolve([]),
    getUserMailbox(user.id),
    prisma.carrierPayLineType.findMany({
      where: { companyId: user.companyId, active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    }),
    loadPageLayouts("load-detail"),
    prisma.customer.findMany({
      where: scope,
      orderBy: { name: "asc" }
    }),
    prisma.facility.findMany({
      where: { ...scope, status: "Active" },
      include: { customer: true },
      orderBy: [{ name: "asc" }, { city: "asc" }]
    }),
    canPickBranch(user)
      ? prisma.branch.findMany({
          where: {
            companyId: user.companyId,
            ...(isAdminRole(user.role) ? {} : { id: { in: user.branchIds } })
          },
          orderBy: { name: "asc" }
        })
      : Promise.resolve([]),
    prisma.commodityOption.findMany({
      where: { companyId: user.companyId, active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    }),
    prisma.customerChargeType.findMany({
      where: { companyId: user.companyId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    })
  ]);

  if (!load || !(await canAccessRecord(user, load.branchId))) {
    notFound();
  }

  const hasFleetDispatch = planHasFeature(user.plan, "fleet_dispatch");
  const [fleetDrivers, fleetTrucks, fleetTrailers] = hasFleetDispatch
    ? await Promise.all([
        prisma.driver.findMany({
          where: { companyId: user.companyId, status: "ACTIVE" },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
        }),
        prisma.truck.findMany({
          where: { companyId: user.companyId, status: "ACTIVE" },
          orderBy: { unitNumber: "asc" }
        }),
        prisma.trailer.findMany({
          where: { companyId: user.companyId, status: "ACTIVE" },
          orderBy: { unitNumber: "asc" }
        })
      ])
    : [[], [], []];

  const usedChargeTypeIds = new Set(
    load.charges.map((charge) => charge.lineTypeId).filter((id): id is string => Boolean(id))
  );
  const chargeTypesForEditor = chargeTypes.filter(
    (type) => type.active || usedChargeTypeIds.has(type.id)
  );

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

  const primaryDispatch = primaryAssignment(load.dispatchAssignments);
  const carrierAssignments = load.dispatchAssignments.filter((row) => row.carrierId);
  const hasAnyCarrier = carrierAssignments.length > 0;

  const latestReportedLocation = load.dispatchAssignments
    .flatMap((row) => row.checkCalls)
    .find((call) => call.latitude != null && call.longitude != null);
  const reportedLocation = latestReportedLocation
    ? {
        label: latestReportedLocation.location,
        latitude: latestReportedLocation.latitude!,
        longitude: latestReportedLocation.longitude!
      }
    : null;

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

  const customerOptions = customers.map((customer) => ({
    id: customer.id,
    label: customer.name,
    description: [customer.city, customer.state].filter(Boolean).join(", ")
  }));
  const facilityOptions = facilities.map((facility) => ({
    id: facility.id,
    label: facility.name,
    description: facility.customer?.name,
    address: facility.address,
    city: facility.city,
    state: facility.state,
    postalCode: facility.postalCode
  }));
  const freightLines = load.commodityLines.map((line) => ({
    quantity: line.quantity,
    description: line.description,
    weightLbs: line.weightLbs,
    pieces: line.pieces,
    lengthIn: line.lengthIn,
    widthIn: line.widthIn,
    heightIn: line.heightIn
  }));

  const publicNotes = load.notes.filter((note) => !isPrivateLoadNote(note));
  const privateNotes = load.notes.filter((note) => isPrivateLoadNote(note));
  const canNotes = userHasPlanFeature(user, "load_notes");
  const canRoute = userHasPlanFeature(user, "route_map");
  const canDocs = userHasPlanFeature(user, "documents_upload");
  const canEmail = userHasPlanFeature(user, "email_ops");
  const canCommission = userHasPlanFeature(user, "commissions");
  const canDelete = userHasPlanFeature(user, "delete_loads");
  const canAccounting = userHasPlanFeature(user, "accounting_ar_ap");
  const detailTiles = LOAD_DETAIL_TILES.filter((tile) => {
    if (tile.id === "route-map") return canRoute;
    if (tile.id === "documents") return canDocs;
    if (tile.id === "email") return canEmail;
    if (tile.id === "commission") return canCommission;
    return true;
  });

  return (
    <>
      <PageHeader
        title={load.loadNumber}
        description={`${load.customer.name} freight from ${load.pickupCity}, ${load.pickupState} to ${load.deliveryCity}, ${load.deliveryState}.`}
        action={
          canWrite(user) ? (
            <>
              <CloneLoadButton loadId={load.id} loadNumber={load.loadNumber} />
              {canDelete ? <DeleteLoadButton loadId={load.id} loadNumber={load.loadNumber} /> : null}
            </>
          ) : undefined
        }
      />

      {saved ? (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
          Load saved successfully.
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}

      {emailed ? (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
          Email sent ({humanize(emailed.replace(/-/g, "_"))}).
        </div>
      ) : null}

      {!mailbox && canEmail ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Connect your mailbox in{" "}
          <a href="/settings/email" className="font-semibold underline">
            Email settings
          </a>{" "}
          to send rate confirmations, invoices, load confirmations, and POD requests as yourself.
        </div>
      ) : null}

      <TileBoard pageId="load-detail" tiles={detailTiles} initialLayouts={layouts ?? null}>
        <Tile id="summary">
          <div className="grid gap-8">
            <LoadDetailsEditor
              loadId={load.id}
              writable={canWrite(user)}
              customerId={load.customerId}
              customerOptions={customerOptions}
              branchId={load.branchId}
              branches={branches}
              canPickBranch={canPickBranch(user)}
              referenceNumber={load.referenceNumber}
              equipmentType={load.equipmentType}
              reeferTempF={load.reeferTempF}
              revenueCents={load.revenueCents}
              carrierCostCents={load.carrierCostCents}
              commodity={load.commodity}
              weight={load.weight}
              freightLines={freightLines}
              descriptionSuggestions={commodities.map((item) => item.name)}
              chargeTypes={chargeTypesForEditor.map((type) => ({
                id: type.id,
                name: type.name,
                calculationMethod: type.calculationMethod
              }))}
              charges={load.charges.map((charge) => ({
                id: charge.id,
                label: charge.label,
                chargeType: charge.chargeType,
                description: charge.description,
                unitRateCents: charge.unitRateCents,
                quantity: charge.quantity,
                amountCents: charge.amountCents,
                lineTypeId: charge.lineTypeId
              }))}
              defaultMiles={load.routeTotalMiles}
              stops={load.stops}
              facilities={facilityOptions}
              statusBadge={<StatusBadge value={load.status} />}
              marginLabel={formatMoney(load.revenueCents - load.carrierCostCents)}
              marginPercentLabel={marginPercent(load.revenueCents, load.carrierCostCents)}
            />

            <div className="grid gap-3 border-t border-border pt-6">
              <div>
                <h3 className="font-semibold text-foreground">Stops</h3>
                <p className="muted text-sm">
                  {canWrite(user)
                    ? "Use Edit details to add, remove, or reorder pickups and deliveries."
                    : "Pickup and delivery stops for this load."}
                </p>
              </div>
              <div className="grid gap-3">
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
                      <span className="text-sm text-muted-foreground">
                        {formatDateTime(stop.appointmentAt)}
                      </span>
                    </div>
                    {stop.instructions ? (
                      <p className="mt-3 rounded-xl bg-muted p-3 text-sm text-slate-700">
                        {stop.instructions}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            {canNotes ? (
            <div className="grid gap-3 border-t border-border pt-6">
              <div>
                <h3 className="font-semibold text-foreground">Notes</h3>
                <p className="muted text-sm">
                  Public notes appear on rate confirmations, load confirmations, BOLs, invoices, and
                  related documents. Private notes stay internal only.
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-border p-4">
                  <h4 className="font-semibold text-foreground">Public Notes</h4>
                  <div className="mt-3 grid gap-3">
                    {publicNotes.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No public notes yet.</p>
                    ) : (
                      publicNotes.map((note) => (
                        <div key={note.id} className="rounded-xl bg-muted p-3 text-sm">
                          <p className="text-slate-700 whitespace-pre-wrap">{note.body}</p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {note.user?.name ?? "System"} · {formatDateTime(note.createdAt)}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                  {canWrite(user) ? (
                    <form action={addLoadNote} className="mt-4 grid gap-3">
                      <input type="hidden" name="loadId" value={load.id} />
                      <input type="hidden" name="visibility" value="public" />
                      <textarea
                        name="body"
                        className="textarea"
                        rows={3}
                        placeholder="Add a public note…"
                        required
                      />
                      <button type="submit" className="btn-secondary">
                        Save Public Note
                      </button>
                    </form>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-border p-4">
                  <h4 className="font-semibold text-foreground">Private Notes</h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Never shown on documents, emails, or reports.
                  </p>
                  <div className="mt-3 grid gap-3">
                    {privateNotes.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No private notes yet.</p>
                    ) : (
                      privateNotes.map((note) => (
                        <div key={note.id} className="rounded-xl bg-muted p-3 text-sm">
                          <p className="text-slate-700 whitespace-pre-wrap">{note.body}</p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {note.user?.name ?? "System"} · {formatDateTime(note.createdAt)}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                  {canWrite(user) ? (
                    <form action={addLoadNote} className="mt-4 grid gap-3">
                      <input type="hidden" name="loadId" value={load.id} />
                      <input type="hidden" name="visibility" value="private" />
                      <textarea
                        name="body"
                        className="textarea"
                        rows={3}
                        placeholder="Add a private note…"
                        required
                      />
                      <button type="submit" className="btn-secondary">
                        Save Private Note
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>
            </div>
            ) : null}

            {canAccounting ? (
            <div className="grid gap-3 border-t border-border pt-6">
              <h3 className="font-semibold text-foreground">Accounting</h3>
              <div className="grid gap-3">
                {load.invoices.length === 0 && load.carrierBills.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No invoices or carrier bills yet.</p>
                ) : null}
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
                      {exportView ? (
                        <p className="mt-1 text-sm text-slate-700">{exportView.label}</p>
                      ) : null}
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
                      {exportView ? (
                        <p className="mt-1 text-sm text-slate-700">{exportView.label}</p>
                      ) : null}
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
            </div>
            ) : null}
          </div>
        </Tile>

        <Tile id="workflow">
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
        </Tile>

        {canRoute ? (
        <Tile id="route-map">
          <LoadRoutePanel loadId={load.id} reportedLocation={reportedLocation} />
        </Tile>
        ) : null}

        <Tile id="rate-terms">
          <p className="muted">
            Override customer default terms for this load only. Leave blank to use the customer
            profile terms when generating a rate confirmation.
          </p>
          {!load.rateConfirmationTerms?.trim() && load.customer.rateConfirmationTerms?.trim() ? (
            <div className="mt-3 rounded-2xl border border-dashed border-border bg-muted/60 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Customer default (in use)
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                {load.customer.rateConfirmationTerms}
              </p>
            </div>
          ) : null}
          {canWrite(user) ? (
            <form action={updateLoadRateConfirmationTerms} className="mt-4 grid gap-3">
              <input type="hidden" name="loadId" value={load.id} />
              <textarea
                name="rateConfirmationTerms"
                className="textarea"
                rows={5}
                defaultValue={load.rateConfirmationTerms ?? ""}
                placeholder="Optional load-specific rate confirmation terms…"
              />
              <button type="submit" className="btn-secondary">
                Save Rate Con Terms
              </button>
            </form>
          ) : (
            <p className="mt-4 whitespace-pre-wrap rounded-2xl bg-muted p-4 text-sm text-slate-700">
              {load.rateConfirmationTerms?.trim() ||
                load.customer.rateConfirmationTerms?.trim() ||
                "No custom rate confirmation terms."}
            </p>
          )}
        </Tile>

        {canDocs ? (
        <Tile id="documents">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="muted">Generate printable carrier, shipper, and customer paperwork.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {carrierAssignments.length > 0 ? (
                carrierAssignments.map((assignment) => (
                  <form key={assignment.id} action={generateRateConfirmation}>
                    <input type="hidden" name="loadId" value={load.id} />
                    <input type="hidden" name="assignmentId" value={assignment.id} />
                    <button className="btn-secondary" type="submit">
                      Rate Con
                      {carrierAssignments.length > 1
                        ? ` (${assignment.carrier?.name ?? "Carrier"})`
                        : ""}
                    </button>
                  </form>
                ))
              ) : (
                <button className="btn-secondary" type="button" disabled>
                  Generate Rate Con
                </button>
              )}
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
            {carrierAssignments.length > 0 ? (
              carrierAssignments.map((assignment) => (
                <EmailComposeButton
                  key={assignment.id}
                  loadId={load.id}
                  purpose="CARRIER_RATE_CONFIRMATION"
                  label={
                    carrierAssignments.length > 1
                      ? `Email Rate Con (${assignment.carrier?.name ?? "Carrier"})`
                      : "Email Rate Con"
                  }
                  disabled={!mailbox || !canWrite(user)}
                  assignmentId={assignment.id}
                />
              ))
            ) : (
              <EmailComposeButton
                loadId={load.id}
                purpose="CARRIER_RATE_CONFIRMATION"
                label="Email Rate Con"
                disabled
              />
            )}
            <EmailComposeButton
              loadId={load.id}
              purpose="CUSTOMER_LOAD_CONFIRMATION"
              label="Email Load Con"
              disabled={!mailbox || !canWrite(user)}
            />
            <EmailComposeButton
              loadId={load.id}
              purpose="BOL"
              label="Email BOL"
              disabled={!mailbox || !canWrite(user)}
            />
            <EmailComposeButton
              loadId={load.id}
              purpose="INVOICE"
              label="Email Invoice"
              disabled={!mailbox || !canWrite(user)}
            />
            <EmailComposeButton
              loadId={load.id}
              purpose="POD_REQUEST"
              label="Email POD Request"
              disabled={!mailbox || !hasAnyCarrier || !canWrite(user)}
              assignmentId={primaryDispatch?.id}
            />
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
              defaultCarrierId={primaryDispatch?.carrierId ?? undefined}
              showEntityPickers={false}
              submitLabel="Add Document"
            />
          </div>
        </Tile>
        ) : null}

        {canEmail ? (
        <Tile id="email">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
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
        </Tile>
        ) : null}

        <Tile id="carrier">
          {hasFleetDispatch ? (
            <div className="mb-6">
              <FleetAssignmentPanel
                loadId={load.id}
                drivers={fleetDrivers.map((driver) => ({
                  id: driver.id,
                  label: driverDisplayName(driver)
                }))}
                trucks={fleetTrucks.map((truck) => ({
                  id: truck.id,
                  label: truck.unitNumber
                }))}
                trailers={fleetTrailers.map((trailer) => ({
                  id: trailer.id,
                  label: trailer.unitNumber
                }))}
                current={
                  primaryDispatch
                    ? {
                        driverId: primaryDispatch.driverId,
                        truckId: primaryDispatch.truckId,
                        trailerId: primaryDispatch.trailerId,
                        driverName: primaryDispatch.driverName,
                        truckNumber: primaryDispatch.truckNumber,
                        trailerNumber: primaryDispatch.trailerNumber
                      }
                    : null
                }
              />
            </div>
          ) : null}

          <details
            className={hasFleetDispatch ? "rounded-2xl border border-border p-4" : undefined}
            open={!hasFleetDispatch}
          >
            {hasFleetDispatch ? (
              <summary className="cursor-pointer text-sm font-semibold text-foreground">
                Assign Carrier
              </summary>
            ) : null}
            <div className={hasFleetDispatch ? "mt-4" : undefined}>
              <p className="muted">
                Current: {carrierDisplayName(load.dispatchAssignments)}
              </p>
              <div className="mt-4">
                <CarrierAssignmentsPanel
                  loadId={load.id}
                  carrierOptions={carrierOptions}
                  lineTypes={payLineTypes.map((type) => ({
                    id: type.id,
                    name: type.name,
                    calculationMethod: type.calculationMethod
                  }))}
                  defaultMiles={load.routeTotalMiles}
                  assignments={load.dispatchAssignments.map((assignment) => ({
                    id: assignment.id,
                    sequence: assignment.sequence,
                    carrierId: assignment.carrierId,
                    carrierName: assignment.carrier?.name ?? null,
                    rateCents: assignment.rateCents,
                    driverName: assignment.driverName,
                    driverPhone: assignment.driverPhone,
                    truckNumber: assignment.truckNumber,
                    trailerNumber: assignment.trailerNumber,
                    originFacilityName: assignment.originFacilityName,
                    originCity: assignment.originCity,
                    originState: assignment.originState,
                    originPostalCode: assignment.originPostalCode,
                    destinationFacilityName: assignment.destinationFacilityName,
                    destinationCity: assignment.destinationCity,
                    destinationState: assignment.destinationState,
                    destinationPostalCode: assignment.destinationPostalCode,
                    payLines: (assignment.payLines?.length
                      ? assignment.payLines
                      : load.carrierPayLines.filter(
                          (line) => line.assignmentId === assignment.id
                        )
                    ).map((line) => ({
                      lineTypeId: line.lineTypeId,
                      description: line.description,
                      unitRateCents: line.unitRateCents,
                      quantity: line.quantity,
                      amountCents: line.amountCents
                    }))
                  }))}
                  hasFleetDispatch={hasFleetDispatch}
                  canWrite={canWrite(user)}
                  canEmail={canEmail}
                  canGenerateRateCon={userHasPlanFeature(user, "generate_rate_con")}
                  mailboxConnected={Boolean(mailbox)}
                  locked={["INVOICED", "PAID"].includes(load.status)}
                />
              </div>
            </div>
          </details>
        </Tile>

        {primaryDispatch ? (
          <Tile id="check-calls">
            <div className="mt-4 grid gap-3">
              {load.dispatchAssignments.flatMap((assignment) =>
                assignment.checkCalls.map((call) => (
                  <div key={call.id} className="rounded-2xl border border-border p-3">
                    {load.dispatchAssignments.length > 1 ? (
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {assignment.carrier?.name ??
                          (assignment.sequence === 0 ? "Primary" : `Leg ${assignment.sequence + 1}`)}
                      </p>
                    ) : null}
                    <p className="font-semibold text-foreground">{call.status}</p>
                    <p className="muted">{call.location}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(call.occurredAt)}</p>
                    {call.notes ? <p className="mt-2 text-sm text-slate-700">{call.notes}</p> : null}
                    {call.nextCheckAt ? (
                      <div className="mt-3 rounded-xl border border-primary/20 bg-lightprimary/50 p-3 text-sm">
                        <p className="font-semibold text-primary">
                          Next check call: {formatDateTime(call.nextCheckAt)}
                        </p>
                        {call.nextCheckNotes ? (
                          <p className="mt-1 text-slate-700">{call.nextCheckNotes}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
            <CheckCallForm
              action={addCheckCall}
              assignmentId={primaryDispatch.id}
              loadId={load.id}
            />
          </Tile>
        ) : null}

        {canCommission ? (
        <Tile id="commission">
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
        </Tile>
        ) : null}

        <Tile id="activity">
          {canWrite(user) ? (
            <form action={addLoadActivityNote} className="mt-4 grid gap-3 rounded-2xl bg-muted p-4">
              <input type="hidden" name="loadId" value={load.id} />
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
          <div className="mt-4 grid gap-3">
            {load.activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              load.activities.map((activity) => (
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
      </TileBoard>
    </>
  );
}
