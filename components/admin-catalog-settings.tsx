import {
  createCarrierPayLineType,
  createCommodityOption,
  createCustomerChargeType,
  createDriverPayLineType,
  deleteCarrierPayLineType,
  deleteCommodityOption,
  deleteCustomerChargeType,
  deleteDriverPayLineType,
  toggleCarrierPayLineTypeActive,
  toggleCommodityActive,
  toggleCustomerChargeTypeActive,
  toggleDriverPayLineTypeActive,
  updateCarrierPayLineType,
  updateCommodityOption,
  updateCustomerChargeType,
  updateDriverPayLineType
} from "@/lib/catalog-actions";
import { carrierPayCalculationMethods, driverPayCalculationMethods } from "@/lib/constants";
import { humanize } from "@/lib/format";

type CommodityRow = {
  id: string;
  name: string;
  active: boolean;
  sortOrder: number;
};

type PayLineTypeRow = {
  id: string;
  name: string;
  calculationMethod: string;
  active: boolean;
  sortOrder: number;
  isSystem: boolean;
  usageCount: number;
};

type ChargeTypeRow = {
  id: string;
  name: string;
  calculationMethod: string;
  active: boolean;
  sortOrder: number;
  isSystem: boolean;
  usageCount: number;
  includeInDriverPay: boolean;
};

export function AdminCatalogSettings({
  commodities,
  payLineTypes,
  driverPayLineTypes = [],
  chargeTypes
}: {
  commodities: CommodityRow[];
  payLineTypes: PayLineTypeRow[];
  driverPayLineTypes?: PayLineTypeRow[];
  chargeTypes: ChargeTypeRow[];
}) {
  return (
    <div className="grid gap-6">
      <section className="card">
        <h2 className="section-title">Commodities</h2>
        <p className="muted">
          Manage the commodity dropdown used when creating loads. Inactive items are hidden from new
          selection but remain available on historical loads.
        </p>

        <form action={createCommodityOption} className="mt-4 grid gap-3 md:grid-cols-[1fr_120px_auto]">
          <label className="grid gap-2">
            <span className="label">Name</span>
            <input name="name" className="input" placeholder="e.g. Paper goods" required />
          </label>
          <label className="grid gap-2">
            <span className="label">Sort</span>
            <input name="sortOrder" className="input" type="number" min={0} defaultValue={commodities.length} />
          </label>
          <div className="flex items-end">
            <button type="submit" className="btn">
              Add Commodity
            </button>
          </div>
        </form>

        <div className="mt-4 grid gap-3">
          {commodities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No commodities yet.</p>
          ) : (
            commodities.map((item) => (
              <div
                key={item.id}
                className="grid gap-3 rounded-2xl border border-border p-4 md:grid-cols-[1fr_100px_auto]"
              >
                <form action={updateCommodityOption} className="contents">
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="active" value={item.active ? "true" : "false"} />
                  <label className="grid gap-1">
                    <span className="label">Name</span>
                    <input name="name" className="input" defaultValue={item.name} required />
                  </label>
                  <label className="grid gap-1">
                    <span className="label">Sort</span>
                    <input
                      name="sortOrder"
                      className="input"
                      type="number"
                      min={0}
                      defaultValue={item.sortOrder}
                    />
                  </label>
                  <div className="flex flex-wrap items-end gap-2">
                    <button type="submit" className="btn-secondary">
                      Save
                    </button>
                  </div>
                </form>
                <div className="flex flex-wrap gap-2 md:col-span-3">
                  <form action={toggleCommodityActive}>
                    <input type="hidden" name="id" value={item.id} />
                    <button type="submit" className="btn-secondary">
                      {item.active ? "Deactivate" : "Activate"}
                    </button>
                  </form>
                  <form action={deleteCommodityOption}>
                    <input type="hidden" name="id" value={item.id} />
                    <button type="submit" className="btn-danger">
                      Delete
                    </button>
                  </form>
                  <span className="self-center text-xs text-muted-foreground">
                    {item.active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="card">
        <h2 className="section-title">Carrier Pay Line Types</h2>
        <p className="muted">
          Types available when assigning a carrier. Flat uses a dollar amount; per mile and hourly
          multiply rate × quantity. System types can be deactivated but not deleted.
        </p>

        <form
          action={createCarrierPayLineType}
          className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_120px_auto]"
        >
          <label className="grid gap-2">
            <span className="label">Name</span>
            <input name="name" className="input" placeholder="e.g. Fuel surcharge" required />
          </label>
          <label className="grid gap-2">
            <span className="label">Calculation</span>
            <select name="calculationMethod" className="select" defaultValue="FLAT">
              {carrierPayCalculationMethods.map((method) => (
                <option key={method} value={method}>
                  {humanize(method)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="label">Sort</span>
            <input
              name="sortOrder"
              className="input"
              type="number"
              min={0}
              defaultValue={payLineTypes.length}
            />
          </label>
          <div className="flex items-end">
            <button type="submit" className="btn">
              Add Type
            </button>
          </div>
        </form>

        <div className="mt-4 grid gap-3">
          {payLineTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pay line types yet.</p>
          ) : (
            payLineTypes.map((item) => (
              <div key={item.id} className="grid gap-3 rounded-2xl border border-border p-4">
                <form
                  action={updateCarrierPayLineType}
                  className="grid gap-3 md:grid-cols-[1fr_1fr_100px_auto]"
                >
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="active" value={item.active ? "true" : "false"} />
                  <label className="grid gap-1">
                    <span className="label">Name</span>
                    <input name="name" className="input" defaultValue={item.name} required />
                  </label>
                  <label className="grid gap-1">
                    <span className="label">Calculation</span>
                    <select
                      name="calculationMethod"
                      className="select"
                      defaultValue={item.calculationMethod}
                    >
                      {carrierPayCalculationMethods.map((method) => (
                        <option key={method} value={method}>
                          {humanize(method)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1">
                    <span className="label">Sort</span>
                    <input
                      name="sortOrder"
                      className="input"
                      type="number"
                      min={0}
                      defaultValue={item.sortOrder}
                    />
                  </label>
                  <div className="flex items-end">
                    <button type="submit" className="btn-secondary">
                      Save
                    </button>
                  </div>
                </form>
                <div className="flex flex-wrap items-center gap-2">
                  <form action={toggleCarrierPayLineTypeActive}>
                    <input type="hidden" name="id" value={item.id} />
                    <button type="submit" className="btn-secondary">
                      {item.active ? "Deactivate" : "Activate"}
                    </button>
                  </form>
                  {!item.isSystem && item.usageCount === 0 ? (
                    <form action={deleteCarrierPayLineType}>
                      <input type="hidden" name="id" value={item.id} />
                      <button type="submit" className="btn-danger">
                        Delete
                      </button>
                    </form>
                  ) : null}
                  <span className="text-xs text-muted-foreground">
                    {item.active ? "Active" : "Inactive"}
                    {item.isSystem ? " · System" : ""}
                    {item.usageCount > 0 ? ` · Used on ${item.usageCount} line(s)` : ""}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="card">
        <h2 className="section-title">Customer Charge Types</h2>
        <p className="muted">
          Line item types for customer rates on a load. Flat uses a dollar amount; per mile and hourly
          multiply rate × quantity. Uncheck &quot;Include in driver % pay&quot; to exclude types (permits,
          escorts, warehouse, etc.) from percentage-of-revenue driver pay. System types can be
          deactivated but not deleted.
        </p>

        <form
          action={createCustomerChargeType}
          className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_120px_auto_auto]"
        >
          <label className="grid gap-2">
            <span className="label">Name</span>
            <input name="name" className="input" placeholder="e.g. Stop Off" required />
          </label>
          <label className="grid gap-2">
            <span className="label">Calculation</span>
            <select name="calculationMethod" className="select" defaultValue="FLAT">
              {carrierPayCalculationMethods.map((method) => (
                <option key={method} value={method}>
                  {humanize(method)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="label">Sort</span>
            <input
              name="sortOrder"
              className="input"
              type="number"
              min={0}
              defaultValue={chargeTypes.length}
            />
          </label>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input type="checkbox" name="includeInDriverPay" value="true" defaultChecked />
            <span>Driver % pay</span>
          </label>
          <div className="flex items-end">
            <button type="submit" className="btn">
              Add Type
            </button>
          </div>
        </form>

        <div className="mt-4 grid gap-3">
          {chargeTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No charge types yet.</p>
          ) : (
            chargeTypes.map((item) => (
              <div key={item.id} className="grid gap-3 rounded-2xl border border-border p-4">
                <form
                  action={updateCustomerChargeType}
                  className="grid gap-3 md:grid-cols-[1fr_1fr_100px_auto_auto]"
                >
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="active" value={item.active ? "true" : "false"} />
                  <label className="grid gap-1">
                    <span className="label">Name</span>
                    <input name="name" className="input" defaultValue={item.name} required />
                  </label>
                  <label className="grid gap-1">
                    <span className="label">Calculation</span>
                    <select
                      name="calculationMethod"
                      className="select"
                      defaultValue={item.calculationMethod}
                    >
                      {carrierPayCalculationMethods.map((method) => (
                        <option key={method} value={method}>
                          {humanize(method)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1">
                    <span className="label">Sort</span>
                    <input
                      name="sortOrder"
                      className="input"
                      type="number"
                      min={0}
                      defaultValue={item.sortOrder}
                    />
                  </label>
                  <label className="flex items-end gap-2 pb-2 text-sm">
                    <input
                      type="checkbox"
                      name="includeInDriverPay"
                      value="true"
                      defaultChecked={item.includeInDriverPay}
                    />
                    <span>Driver % pay</span>
                  </label>
                  <div className="flex items-end">
                    <button type="submit" className="btn-secondary">
                      Save
                    </button>
                  </div>
                </form>
                <div className="flex flex-wrap items-center gap-2">
                  <form action={toggleCustomerChargeTypeActive}>
                    <input type="hidden" name="id" value={item.id} />
                    <button type="submit" className="btn-secondary">
                      {item.active ? "Deactivate" : "Activate"}
                    </button>
                  </form>
                  {!item.isSystem && item.usageCount === 0 ? (
                    <form action={deleteCustomerChargeType}>
                      <input type="hidden" name="id" value={item.id} />
                      <button type="submit" className="btn-danger">
                        Delete
                      </button>
                    </form>
                  ) : null}
                  <span className="text-xs text-muted-foreground">
                    {item.active ? "Active" : "Inactive"}
                    {item.isSystem ? " · System" : ""}
                    {item.includeInDriverPay ? "" : " · Excluded from driver %"}
                    {item.usageCount > 0 ? ` · Used on ${item.usageCount} line(s)` : ""}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="card">
        <h2 className="section-title">Driver Pay Line Types</h2>
        <p className="muted">
          Pay methods for company drivers: flat, rate per mile, or percent of eligible revenue.
        </p>

        <form
          action={createDriverPayLineType}
          className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_120px_auto]"
        >
          <label className="grid gap-2">
            <span className="label">Name</span>
            <input name="name" className="input" placeholder="e.g. Bonus" required />
          </label>
          <label className="grid gap-2">
            <span className="label">Calculation</span>
            <select name="calculationMethod" className="select" defaultValue="FLAT">
              {driverPayCalculationMethods.map((method) => (
                <option key={method} value={method}>
                  {humanize(method)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="label">Sort</span>
            <input
              name="sortOrder"
              className="input"
              type="number"
              min={0}
              defaultValue={driverPayLineTypes.length}
            />
          </label>
          <div className="flex items-end">
            <button type="submit" className="btn">
              Add Type
            </button>
          </div>
        </form>

        <div className="mt-4 grid gap-3">
          {driverPayLineTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No driver pay line types yet.</p>
          ) : (
            driverPayLineTypes.map((item) => (
              <div key={item.id} className="grid gap-3 rounded-2xl border border-border p-4">
                <form
                  action={updateDriverPayLineType}
                  className="grid gap-3 md:grid-cols-[1fr_1fr_100px_auto]"
                >
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="active" value={item.active ? "true" : "false"} />
                  <label className="grid gap-1">
                    <span className="label">Name</span>
                    <input name="name" className="input" defaultValue={item.name} required />
                  </label>
                  <label className="grid gap-1">
                    <span className="label">Calculation</span>
                    <select
                      name="calculationMethod"
                      className="select"
                      defaultValue={item.calculationMethod}
                    >
                      {driverPayCalculationMethods.map((method) => (
                        <option key={method} value={method}>
                          {humanize(method)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1">
                    <span className="label">Sort</span>
                    <input
                      name="sortOrder"
                      className="input"
                      type="number"
                      min={0}
                      defaultValue={item.sortOrder}
                    />
                  </label>
                  <div className="flex items-end">
                    <button type="submit" className="btn-secondary">
                      Save
                    </button>
                  </div>
                </form>
                <div className="flex flex-wrap items-center gap-2">
                  <form action={toggleDriverPayLineTypeActive}>
                    <input type="hidden" name="id" value={item.id} />
                    <button type="submit" className="btn-secondary">
                      {item.active ? "Deactivate" : "Activate"}
                    </button>
                  </form>
                  {!item.isSystem && item.usageCount === 0 ? (
                    <form action={deleteDriverPayLineType}>
                      <input type="hidden" name="id" value={item.id} />
                      <button type="submit" className="btn-danger">
                        Delete
                      </button>
                    </form>
                  ) : null}
                  <span className="text-xs text-muted-foreground">
                    {item.active ? "Active" : "Inactive"}
                    {item.isSystem ? " · System" : ""}
                    {item.usageCount > 0 ? ` · Used on ${item.usageCount} line(s)` : ""}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
