import { EquipmentFields } from "@/components/equipment-fields";
import { FreightLinesEditor } from "@/components/freight-lines-editor";
import { LoadStopsEditor } from "@/components/load-stops-editor";
import { PageHeader } from "@/components/page-header";
import { SearchCombobox } from "@/components/search-combobox";
import { createLoad } from "@/lib/actions";
import { canAccessRecord, getBranchScope } from "@/lib/branch-filter-server";
import { ensureCompanyCatalogs } from "@/lib/catalogs";
import { requireTmsAccess } from "@/lib/permissions";
import { canPickBranch, isAdminRole } from "@/lib/scope";
import { loadStatuses } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { humanize } from "@/lib/format";
import { notFound } from "next/navigation";

function flagEnabled(value: string | undefined) {
  return value === "1" || value === "true";
}

function moneyInput(cents: number) {
  if (!cents) {
    return "";
  }
  return (cents / 100).toFixed(2).replace(/\.00$/, "");
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

  const [company, customers, facilities, branches, commodities, cloneSource] = await Promise.all([
    prisma.company.findUniqueOrThrow({ where: { id: user.companyId } }),
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
    cloneFromId
      ? prisma.load.findUnique({
          where: { id: cloneFromId, companyId: user.companyId },
          include: {
            stops: { orderBy: { sequence: "asc" } },
            commodityLines: { orderBy: { sequence: "asc" } },
            carrierPayLines: { orderBy: { sortOrder: "asc" } },
            dispatchAssignment: { include: { carrier: true } }
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
  const nextSequence = String(company.nextLoadSequence).padStart(4, "0");
  const nextAutoLoadNumber = company.loadNumberPrefix
    ? `${company.loadNumberPrefix}-${nextSequence}`
    : nextSequence;

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
  const clonedRevenue =
    cloneSource && keepRate ? moneyInput(cloneSource.revenueCents) : "";
  const clonedCarrierCost =
    cloneSource && keepRate ? moneyInput(cloneSource.carrierCostCents) : "";
  const assignment = cloneSource?.dispatchAssignment;
  const shouldCloneCarrier = Boolean(keepCarrier && assignment);
  const clonePayLinesJson = shouldCloneCarrier
    ? JSON.stringify(
        cloneSource!.carrierPayLines.map((line) => ({
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
            : "Enter the customer, stops, equipment, freight lines, and first financial estimate."
        }
      />

      {shouldCloneCarrier && assignment?.carrier ? (
        <div className="mb-4 rounded-lg border border-border bg-muted/60 p-3 text-sm text-foreground">
          Carrier <span className="font-semibold">{assignment.carrier.name}</span> and pay lines will
          be assigned when you save.
        </div>
      ) : null}

      <form action={createLoad} className="card grid gap-6">
        {isClone ? (
          <>
            <input type="hidden" name="cloneFromLoadId" value={cloneSource!.id} />
            {keepNotes ? <input type="hidden" name="keepNotes" value="1" /> : null}
            {shouldCloneCarrier && assignment ? (
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

        <div className="grid gap-4 md:grid-cols-3">
          <SearchCombobox
            name="customerId"
            label="Customer"
            placeholder="Search customers"
            options={customerOptions}
            defaultValue={cloneSource?.customerId}
            required
          />
          <label className="grid gap-2">
            <span className="label">Load Number</span>
            <input name="loadNumber" className="input" placeholder={`Auto: ${nextAutoLoadNumber}`} />
          </label>
          <label className="grid gap-2">
            <span className="label">Status</span>
            <select name="status" className="select" defaultValue="AVAILABLE">
              {loadStatuses.map((status) => (
                <option key={status} value={status}>
                  {humanize(status)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {canPickBranch(user) ? (
          <label className="grid gap-2 md:max-w-sm">
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
        ) : null}

        <label className="grid gap-2 md:max-w-sm">
          <span className="label">Customer Reference</span>
          <input name="referenceNumber" className="input" placeholder="PO / tender number" />
        </label>

        <div className="grid gap-4 md:grid-cols-3">
          <EquipmentFields
            defaultEquipmentType={cloneSource?.equipmentType ?? "Dry Van"}
            defaultReeferTempF={cloneSource?.reeferTempF ?? null}
          />
          <label className="grid gap-2">
            <span className="label">Customer Rate</span>
            <input
              name="revenue"
              className="input"
              placeholder="2500"
              defaultValue={clonedRevenue}
              required
            />
          </label>
          <label className="grid gap-2">
            <span className="label">Estimated Carrier Cost</span>
            <input
              name="carrierCost"
              className="input"
              placeholder="1900"
              defaultValue={clonedCarrierCost}
            />
          </label>
        </div>

        <div className="grid gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Freight lines</h3>
            <p className="muted text-sm">
              Add each commodity on the trailer. Quantity, description, and weight are required.
            </p>
          </div>
          <FreightLinesEditor
            descriptionSuggestions={commoditySuggestions}
            initialLines={clonedFreightLines}
          />
        </div>

        <LoadStopsEditor facilities={facilityOptions} initialStops={clonedStops} />

        <label className="grid gap-2">
          <span className="label">Rate confirmation terms override</span>
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
        </label>

        <div className="flex justify-end gap-3">
          <button type="submit" className="btn">
            Save Load
          </button>
        </div>
      </form>
    </>
  );
}
