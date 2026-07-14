import {
  createCarrierPayLineType,
  createCommodityOption,
  deleteCarrierPayLineType,
  deleteCommodityOption,
  toggleCarrierPayLineTypeActive,
  toggleCommodityActive,
  updateCarrierPayLineType,
  updateCommodityOption
} from "@/lib/catalog-actions";
import { carrierPayCalculationMethods } from "@/lib/constants";
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

export function AdminCatalogSettings({
  commodities,
  payLineTypes
}: {
  commodities: CommodityRow[];
  payLineTypes: PayLineTypeRow[];
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
    </div>
  );
}
