"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo } from "react";
import { SearchCombobox } from "@/components/search-combobox";
import { equipmentTypes } from "@/lib/constants";
import type { LoadSearchFilters } from "@/lib/load-search";
import { buildSearchQueryString } from "@/lib/load-search";

type CustomerOption = {
  id: string;
  name: string;
};

export function LoadSearchFilters({
  filters,
  customers,
  commodities,
  basePath = "/search"
}: {
  filters: LoadSearchFilters;
  customers: CustomerOption[];
  commodities: string[];
  basePath?: string;
}) {
  const router = useRouter();

  const customerOptions = useMemo(
    () =>
      customers.map((customer) => ({
        id: customer.id,
        label: customer.name
      })),
    [customers]
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nextFilters: LoadSearchFilters = {
      dateFrom: String(formData.get("dateFrom") ?? ""),
      dateTo: String(formData.get("dateTo") ?? ""),
      customerId: String(formData.get("customerId") ?? ""),
      originCity: String(formData.get("originCity") ?? ""),
      originState: String(formData.get("originState") ?? ""),
      destCity: String(formData.get("destCity") ?? ""),
      destState: String(formData.get("destState") ?? ""),
      equipmentType: String(formData.get("equipmentType") ?? ""),
      commodity: String(formData.get("commodity") ?? ""),
      view: filters.view ?? "loads"
    };

    const query = buildSearchQueryString(nextFilters);
    router.push(query ? `${basePath}?${query}` : basePath);
  }

  function handleClear() {
    const view = filters.view ?? "loads";
    router.push(view === "revenue" ? `${basePath}?view=revenue` : basePath);
  }

  return (
    <section className="card p-5">
      <div className="mb-4">
        <h2 className="section-title">Search Filters</h2>
        <p className="muted">
          Combine date range, customer, lane, equipment, and commodity filters to narrow results.
        </p>
      </div>

      <form className="grid gap-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-2">
            <span className="label">Pickup From</span>
            <input
              type="date"
              name="dateFrom"
              className="input"
              defaultValue={filters.dateFrom ?? ""}
            />
          </label>
          <label className="grid gap-2">
            <span className="label">Pickup To</span>
            <input type="date" name="dateTo" className="input" defaultValue={filters.dateTo ?? ""} />
          </label>
          <SearchCombobox
            name="customerId"
            label="Customer"
            placeholder="Search customers"
            options={customerOptions}
            defaultValue={filters.customerId}
          />
          <label className="grid gap-2">
            <span className="label">Equipment Type</span>
            <select name="equipmentType" className="select" defaultValue={filters.equipmentType ?? ""}>
              <option value="">All equipment</option>
              {equipmentTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="grid gap-2">
            <span className="label">Origin City</span>
            <input
              name="originCity"
              className="input"
              placeholder="e.g. Dallas"
              defaultValue={filters.originCity ?? ""}
            />
          </label>
          <label className="grid gap-2">
            <span className="label">Origin State</span>
            <input
              name="originState"
              className="input"
              placeholder="TX"
              maxLength={2}
              defaultValue={filters.originState ?? ""}
            />
          </label>
          <label className="grid gap-2">
            <span className="label">Destination City</span>
            <input
              name="destCity"
              className="input"
              placeholder="e.g. Chicago"
              defaultValue={filters.destCity ?? ""}
            />
          </label>
          <label className="grid gap-2">
            <span className="label">Destination State</span>
            <input
              name="destState"
              className="input"
              placeholder="IL"
              maxLength={2}
              defaultValue={filters.destState ?? ""}
            />
          </label>
          <label className="grid gap-2">
            <span className="label">Commodity</span>
            <input
              name="commodity"
              className="input"
              list="commodity-options"
              placeholder="e.g. Produce"
              defaultValue={filters.commodity ?? ""}
            />
            <datalist id="commodity-options">
              {commodities.map((commodity) => (
                <option key={commodity} value={commodity} />
              ))}
            </datalist>
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="submit" className="btn">
            Apply Filters
          </button>
          <button type="button" className="btn-secondary" onClick={handleClear}>
            Clear Filters
          </button>
        </div>
      </form>
    </section>
  );
}
