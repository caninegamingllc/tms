import { PageHeader } from "@/components/page-header";
import { FacilityCombobox, SearchCombobox } from "@/components/search-combobox";
import { createLoad } from "@/lib/actions";
import { getBranchScope } from "@/lib/branch-filter-server";
import { requireTmsAccess } from "@/lib/permissions";
import { canPickBranch, isAdminRole } from "@/lib/scope";
import { equipmentTypes, loadStatuses } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { humanize } from "@/lib/format";

export default async function NewLoadPage() {
  const user = await requireTmsAccess();
  const scope = await getBranchScope(user);
  const [company, customers, facilities, branches] = await Promise.all([
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
      : Promise.resolve([])
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
  const nextAutoLoadNumber = `${company.loadNumberPrefix}-${String(company.nextLoadSequence).padStart(4, "0")}`;

  return (
    <>
      <PageHeader
        title="Create Load"
        description="Enter the customer, lane, stop appointments, equipment, and first financial estimate."
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

        <div className="grid gap-4 md:grid-cols-4">
          <label className="grid gap-2">
            <span className="label">Equipment</span>
            <select name="equipmentType" className="select" defaultValue="Dry Van">
              {equipmentTypes.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="label">Commodity</span>
            <input name="commodity" className="input" />
          </label>
          <label className="grid gap-2">
            <span className="label">Weight</span>
            <input name="weight" className="input" type="number" min="0" />
          </label>
          <label className="grid gap-2">
            <span className="label">Customer Rate</span>
            <input name="revenue" className="input" placeholder="2500" required />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-4">
            <FacilityCombobox prefix="pickup" legend="Pickup" facilities={facilityOptions} />
            <label className="grid gap-2">
              <span className="label">Appointment</span>
              <input name="pickupDate" className="input" type="datetime-local" required />
            </label>
            <label className="grid gap-2">
              <span className="label">Instructions</span>
              <textarea name="pickupInstructions" className="textarea" rows={3} />
            </label>
          </div>

          <div className="grid gap-4">
            <FacilityCombobox prefix="delivery" legend="Delivery" facilities={facilityOptions} />
            <label className="grid gap-2">
              <span className="label">Appointment</span>
              <input name="deliveryDate" className="input" type="datetime-local" required />
            </label>
            <label className="grid gap-2">
              <span className="label">Instructions</span>
              <textarea name="deliveryInstructions" className="textarea" rows={3} />
            </label>
          </div>
        </div>

        <label className="grid gap-2 md:max-w-xs">
          <span className="label">Estimated Carrier Cost</span>
          <input name="carrierCost" className="input" placeholder="1900" />
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
