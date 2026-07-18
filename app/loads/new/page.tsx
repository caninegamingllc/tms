import { CustomerChargeLinesEditor } from "@/components/customer-charge-lines-editor";
import { EquipmentFields } from "@/components/equipment-fields";
import { FreightLinesEditor } from "@/components/freight-lines-editor";
import { LoadStopsEditor } from "@/components/load-stops-editor";
import { PageHeader } from "@/components/page-header";
import { SearchCombobox } from "@/components/search-combobox";
import { createLoad } from "@/lib/actions";
import { canAccessRecord, getBranchScope } from "@/lib/branch-filter-server";
import { ensureCompanyCatalogs } from "@/lib/catalogs";
import { primaryAssignment } from "@/lib/dispatch-assignment";
import { requireTmsAccess, userHasPlanFeature } from "@/lib/permissions";
import { canPickBranch, isAdminRole } from "@/lib/scope";
import { loadStatuses } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { humanize } from "@/lib/format";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

function flagEnabled(value: string | undefined) {
  return value === "1" || value === "true";
}

function moneyInput(cents: number) {
  if (!cents) {
    return "";
  }
  return (cents / 100).toFixed(2).replace(/\.00$/, "");
}

function FormSection({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-4 border-b border-border p-6">
      <div>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export default async function NewLoadPage({
  searchParams
}: {
  searchParams: Promise<{
    cloneFrom?: string;
    keepCarrier?: string;
    keepRate?: string;
    keepCommodity?: string;
    keepNotes?: string;
  }>;
}) {
  const user = await requireTmsAccess();
  await ensureCompanyCatalogs(user.companyId);
  const scope = await getBranchScope(user);
  const params = await searchParams;
  const cloneFromId = params.cloneFrom?.trim() || null;
  const keepCarrier = flagEnabled(params.keepCarrier);
  const keepRate = flagEnabled(params.keepRate);
  const keepCommodity = flagEnabled(params.keepCommodity);
  const keepNotes = flagEnabled(params.keepNotes);

  const [customers, facilities, branches, commodities, chargeTypes, cloneSource] =
    await Promise.all([
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
      where: { companyId: user.companyId, active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    }),
    cloneFromId
      ? prisma.load.findUnique({
          where: { id: cloneFromId, companyId: user.companyId },
          include: {
            stops: { orderBy: { sequence: "asc" } },
            commodityLines: { orderBy: { sequence: "asc" } },
            charges: {
              where: { chargeType: { not: "Late Fee" } },
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
            },
            carrierPayLines: { orderBy: { sortOrder: "asc" } },
            dispatchAssignments: {
              orderBy: { sequence: "asc" },
              include: { carrier: true }
            }
          }
        })
      : Promise.resolve(null)
  ]);

  if (cloneFromId) {
    if (!cloneSource || !(await canAccessRecord(user, cloneSource.branchId))) {
      notFound();
    }
  }

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
  const commoditySuggestions = commodities.map((item) => item.name);

  const isClone = Boolean(cloneSource);
  const clonedStops = cloneSource
    ? cloneSource.stops.map((stop) => ({
        type: stop.type,
        facilityId: stop.facilityId,
        facilityName: stop.facilityName,
        address: stop.address,
        city: stop.city,
        state: stop.state,
        postalCode: stop.postalCode,
        appointmentAt: null,
        instructions: stop.instructions
      }))
    : undefined;
  const clonedFreightLines =
    cloneSource && keepCommodity
      ? cloneSource.commodityLines.map((line) => ({
          quantity: line.quantity,
          description: line.description,
          weightLbs: line.weightLbs,
          pieces: line.pieces,
          lengthIn: line.lengthIn,
          widthIn: line.widthIn,
          heightIn: line.heightIn
        }))
      : undefined;
  const clonedCarrierCost =
    cloneSource && keepRate ? moneyInput(cloneSource.carrierCostCents) : "";
  const clonedChargeLines =
    cloneSource && keepRate
      ? cloneSource.charges
          .filter((charge) => charge.lineTypeId)
          .map((charge) => ({
            lineTypeId: charge.lineTypeId as string,
            description: charge.description,
            unitRateCents: charge.unitRateCents || charge.amountCents,
            quantity: charge.quantity || 1,
            amountCents: charge.amountCents
          }))
      : undefined;
  const assignment = primaryAssignment(cloneSource?.dispatchAssignments);
  const shouldCloneCarrier = Boolean(keepCarrier && assignment);
  const clonePayLinesJson = shouldCloneCarrier
    ? JSON.stringify(
        cloneSource!.carrierPayLines
          .filter(
            (line) =>
              line.assignmentId === assignment!.id ||
              (line.assignmentId == null && assignment!.sequence === 0)
          )
          .map((line) => ({
            lineTypeId: line.lineTypeId,
            description: line.description,
            unitRateCents: line.unitRateCents,
            quantity: line.quantity,
            amountCents: line.amountCents,
            sortOrder: line.sortOrder
          }))
      )
    : null;

  return (
    <>
      <PageHeader
        title={isClone ? `Clone Load ${cloneSource!.loadNumber}` : "Create Load"}
        description={
          isClone
            ? "Customer and stops are copied. Set fresh appointment dates, review the options you kept, then save."
            : "Customer, stops, equipment, freight, and rate estimate."
        }
      />

      {shouldCloneCarrier && assignment?.carrier ? (
        <div className="mb-4 rounded-lg border border-border bg-muted/60 p-3 text-sm text-foreground">
          Carrier <span className="font-semibold">{assignment.carrier.name}</span> and pay lines will
          be assigned when you save.
        </div>
      ) : null}

      <form action={createLoad} className="card mx-auto max-w-5xl overflow-hidden p-0">
        {isClone ? (
          <>
            <input type="hidden" name="cloneFromLoadId" value={cloneSource!.id} />
            {keepNotes ? <input type="hidden" name="keepNotes" value="1" /> : null}
            {shouldCloneCarrier && assignment?.carrierId ? (
              <>
                <input type="hidden" name="cloneCarrierId" value={assignment.carrierId} />
                <input type="hidden" name="cloneDriverName" value={assignment.driverName ?? ""} />
                <input type="hidden" name="cloneDriverPhone" value={assignment.driverPhone ?? ""} />
                <input type="hidden" name="cloneTruckNumber" value={assignment.truckNumber ?? ""} />
                <input type="hidden" name="cloneTrailerNumber" value={assignment.trailerNumber ?? ""} />
                {clonePayLinesJson ? (
                  <input type="hidden" name="clonePayLinesJson" value={clonePayLinesJson} />
                ) : null}
              </>
            ) : null}
          </>
        ) : null}

        <FormSection
          title="Load details"
          description="Load number is assigned automatically when you save."
        >
          <div className="grid gap-4 sm:grid-cols-12">
            <SearchCombobox
              name="customerId"
              label="Customer"
              placeholder="Search customers"
              options={customerOptions}
              defaultValue={cloneSource?.customerId}
              required
              className="sm:col-span-6"
            />
            <label className="grid gap-2 sm:col-span-3">
              <span className="label">Status</span>
              <select name="status" className="select" defaultValue="AVAILABLE">
                {loadStatuses.map((status) => (
                  <option key={status} value={status}>
                    {humanize(status)}
                  </option>
                ))}
              </select>
            </label>
            {canPickBranch(user) ? (
              <label className="grid gap-2 sm:col-span-3">
                <span className="label">Branch</span>
                <select name="branchId" className="select" defaultValue={cloneSource?.branchId ?? ""}>
                  <option value="">Default to your branch</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="hidden sm:col-span-3 sm:block" aria-hidden="true" />
            )}

            <label className="grid gap-2 sm:col-span-5">
              <span className="label">Customer Reference</span>
              <input name="referenceNumber" className="input" placeholder="PO / tender number" />
            </label>
            <EquipmentFields
              className="sm:col-span-4"
              defaultEquipmentType={cloneSource?.equipmentType ?? "Dry Van"}
              defaultReeferTempF={cloneSource?.reeferTempF ?? null}
            />
            <label className="grid gap-2 sm:col-span-3">
              <span className="label">Estimated Carrier Cost</span>
              <input
                name="carrierCost"
                className="input"
                placeholder="1900"
                defaultValue={clonedCarrierCost}
              />
            </label>
          </div>
        </FormSection>

        <FormSection
          title="Stops"
          description="Add pickups and deliveries in route order. At least one of each is required."
        >
          <LoadStopsEditor
            facilities={facilityOptions}
            initialStops={clonedStops}
            showHeader={false}
          />
        </FormSection>

        <FormSection
          title="Freight lines"
          description="Add each commodity on the trailer. Quantity, description, and weight are required."
        >
          <FreightLinesEditor
            descriptionSuggestions={commoditySuggestions}
            initialLines={clonedFreightLines}
          />
        </FormSection>

        <FormSection
          title="Customer charges"
          description="Choose a charge type for each line (flat, per mile, hourly, detention, and other accessorials). Quantity and rate fields update from the type."
        >
          <CustomerChargeLinesEditor
            lineTypes={chargeTypes.map((type) => ({
              id: type.id,
              name: type.name,
              calculationMethod: type.calculationMethod
            }))}
            initialLines={clonedChargeLines}
            defaultMiles={cloneSource?.routeTotalMiles}
          />
        </FormSection>

        {userHasPlanFeature(user, "load_notes") ? (
          <FormSection
            title="Notes"
            description="Public notes appear on rate confirmations and related documents. Private notes stay internal only."
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="grid gap-2">
                <span className="label">Public note</span>
                <textarea
                  name="publicNote"
                  className="textarea"
                  rows={3}
                  placeholder="Optional — shown on customer-facing documents"
                />
                <p className="text-xs text-muted-foreground">Visible on customer-facing documents</p>
              </label>
              <label className="grid gap-2">
                <span className="label">Private note</span>
                <textarea
                  name="privateNote"
                  className="textarea"
                  rows={3}
                  placeholder="Optional — internal only, never on documents"
                />
                <p className="text-xs text-muted-foreground">Internal only — never printed on documents</p>
              </label>
            </div>
          </FormSection>
        ) : null}

        <FormSection
          title="Rate confirmation terms"
          description="Optional terms that will appear on the rate con PDF for this load only."
        >
          <textarea
            name="rateConfirmationTerms"
            className="textarea"
            rows={4}
            defaultValue={cloneSource?.rateConfirmationTerms ?? ""}
            placeholder="Optional — leave blank to use the customer’s default rate confirmation terms"
          />
          <p className="text-xs text-muted-foreground">
            Appended after built-in broker terms on rate confirmations for this load only.
          </p>
        </FormSection>

        <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/50 px-6 py-4">
          <p className="text-xs text-muted-foreground">
            A load number will be assigned automatically once saved.
          </p>
          <button type="submit" className="btn">
            Save Load
          </button>
        </div>
      </form>
    </>
  );
}
