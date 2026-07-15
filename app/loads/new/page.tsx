import { EquipmentFields } from "@/components/equipment-fields";
import { FreightLinesEditor } from "@/components/freight-lines-editor";
import { LoadStopsEditor } from "@/components/load-stops-editor";
import { PageHeader } from "@/components/page-header";
import { SearchCombobox } from "@/components/search-combobox";
import { createLoad } from "@/lib/actions";
import { getBranchScope } from "@/lib/branch-filter-server";
import { ensureCompanyCatalogs } from "@/lib/catalogs";
import { requireTmsAccess } from "@/lib/permissions";
import { canPickBranch, isAdminRole } from "@/lib/scope";
import { loadStatuses } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { humanize } from "@/lib/format";

export default async function NewLoadPage() {
  const user = await requireTmsAccess();
  await ensureCompanyCatalogs(user.companyId);
  const scope = await getBranchScope(user);
  const [company, customers, facilities, branches, commodities] = await Promise.all([
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
    })
  ]);

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
  const nextAutoLoadNumber = `${company.loadNumberPrefix}-${String(company.nextLoadSequence).padStart(4, "0")}`;

  return (
    <>
      <PageHeader
        title="Create Load"
        description="Enter the customer, stops, equipment, freight lines, and first financial estimate."
      />

      <form action={createLoad} className="card grid gap-6">
        <div className="grid gap-4 md:grid-cols-3">
          <SearchCombobox
            name="customerId"
            label="Customer"
            placeholder="Search customers"
            options={customerOptions}
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
            <select name="branchId" className="select" defaultValue="">
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
          <EquipmentFields />
          <label className="grid gap-2">
            <span className="label">Customer Rate</span>
            <input name="revenue" className="input" placeholder="2500" required />
          </label>
          <label className="grid gap-2">
            <span className="label">Estimated Carrier Cost</span>
            <input name="carrierCost" className="input" placeholder="1900" />
          </label>
        </div>

        <div className="grid gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Freight lines</h3>
            <p className="muted text-sm">
              Add each commodity on the trailer. Quantity, description, and weight are required.
            </p>
          </div>
          <FreightLinesEditor descriptionSuggestions={commoditySuggestions} />
        </div>

        <LoadStopsEditor facilities={facilityOptions} />

        <label className="grid gap-2">
          <span className="label">Rate confirmation terms override</span>
          <textarea
            name="rateConfirmationTerms"
            className="textarea"
            rows={4}
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
