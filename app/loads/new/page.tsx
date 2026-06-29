import { PageHeader } from "@/components/page-header";
import { createLoad } from "@/lib/actions";
import { equipmentTypes, loadStatuses } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { humanize } from "@/lib/format";

export default async function NewLoadPage() {
  const customers = await prisma.customer.findMany({ orderBy: { name: "asc" } });

  return (
    <>
      <PageHeader
        title="Create Load"
        description="Enter the customer, lane, stop appointments, equipment, and first financial estimate."
      />

      <form action={createLoad} className="card grid gap-6">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="grid gap-2">
            <span className="label">Customer</span>
            <select name="customerId" className="select" required>
              <option value="">Select customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="label">Load Number</span>
            <input name="loadNumber" className="input" placeholder="Auto if blank" />
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

        <div className="grid gap-4 md:grid-cols-3">
          <label className="grid gap-2 md:col-span-2">
            <span className="label">Load Title</span>
            <input name="title" className="input" placeholder="Food products to Dallas DC" required />
          </label>
          <label className="grid gap-2">
            <span className="label">Customer Reference</span>
            <input name="referenceNumber" className="input" placeholder="PO / tender number" />
          </label>
        </div>

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
          <fieldset className="grid gap-4 rounded-2xl border border-border p-4">
            <legend className="px-2 text-sm font-semibold text-ink">Pickup</legend>
            <label className="grid gap-2">
              <span className="label">Facility</span>
              <input name="pickupFacility" className="input" required />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="label">City</span>
                <input name="pickupCity" className="input" required />
              </label>
              <label className="grid gap-2">
                <span className="label">State</span>
                <input name="pickupState" className="input" maxLength={2} required />
              </label>
            </div>
            <label className="grid gap-2">
              <span className="label">Appointment</span>
              <input name="pickupDate" className="input" type="datetime-local" required />
            </label>
            <label className="grid gap-2">
              <span className="label">Instructions</span>
              <textarea name="pickupInstructions" className="textarea" rows={3} />
            </label>
          </fieldset>

          <fieldset className="grid gap-4 rounded-2xl border border-border p-4">
            <legend className="px-2 text-sm font-semibold text-ink">Delivery</legend>
            <label className="grid gap-2">
              <span className="label">Facility</span>
              <input name="deliveryFacility" className="input" required />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="label">City</span>
                <input name="deliveryCity" className="input" required />
              </label>
              <label className="grid gap-2">
                <span className="label">State</span>
                <input name="deliveryState" className="input" maxLength={2} required />
              </label>
            </div>
            <label className="grid gap-2">
              <span className="label">Appointment</span>
              <input name="deliveryDate" className="input" type="datetime-local" required />
            </label>
            <label className="grid gap-2">
              <span className="label">Instructions</span>
              <textarea name="deliveryInstructions" className="textarea" rows={3} />
            </label>
          </fieldset>
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
