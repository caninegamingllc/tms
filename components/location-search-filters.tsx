"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo } from "react";
import { SearchCombobox } from "@/components/search-combobox";
import { facilityTypes } from "@/lib/constants";
import { humanize } from "@/lib/format";
import type { LocationFilters } from "@/lib/location-search";
import { buildLocationQueryString } from "@/lib/location-search";
import { appendSearchSubmitted } from "@/lib/list-search";

type CustomerOption = {
  id: string;
  name: string;
};

export function LocationSearchFilters({
  filters,
  customers
}: {
  filters: LocationFilters;
  customers: CustomerOption[];
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
    const nextFilters: LocationFilters = {
      q: String(formData.get("q") ?? ""),
      type: String(formData.get("type") ?? "") as LocationFilters["type"],
      customerId: String(formData.get("customerId") ?? "")
    };

    const query = appendSearchSubmitted(buildLocationQueryString(nextFilters));
    router.push(`/locations?${query}`);
  }

  function handleClear() {
    router.push("/locations");
  }

  return (
    <div className="grid gap-4">
      <p className="muted">Search by facility name, address, city, state, type, or linked customer.</p>

      <form className="grid gap-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="grid gap-2">
            <span className="label">Search</span>
            <input
              name="q"
              className="input"
              placeholder="Name, address, city, state, or postal code"
              defaultValue={filters.q ?? ""}
            />
          </label>

          <label className="grid gap-2">
            <span className="label">Facility Type</span>
            <select name="type" className="select" defaultValue={filters.type ?? ""}>
              <option value="">All types</option>
              {facilityTypes.map((type) => (
                <option key={type} value={type}>
                  {humanize(type)}
                </option>
              ))}
            </select>
          </label>

          <SearchCombobox
            name="customerId"
            label="Customer"
            placeholder="Filter by customer"
            options={customerOptions}
            defaultValue={filters.customerId}
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="submit" className="btn">
            Search
          </button>
          <button type="button" className="btn-secondary" onClick={handleClear}>
            Clear
          </button>
        </div>
      </form>
    </div>
  );
}
