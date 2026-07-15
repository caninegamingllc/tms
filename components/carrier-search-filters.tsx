"use client";

import { useRouter } from "next/navigation";
import { FormEvent } from "react";
import { equipmentTypes } from "@/lib/constants";
import type { CarrierFilters } from "@/lib/carrier-search";
import { buildCarrierQueryString } from "@/lib/carrier-search";
import { appendSearchSubmitted } from "@/lib/list-search";

const complianceStatuses = ["Approved", "Needs Review", "Review Soon", "Blocked"];

export function CarrierSearchFilters({ filters }: { filters: CarrierFilters }) {
  const router = useRouter();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nextFilters: CarrierFilters = {
      q: String(formData.get("q") ?? ""),
      complianceStatus: String(formData.get("complianceStatus") ?? ""),
      equipmentType: String(formData.get("equipmentType") ?? "")
    };

    const query = appendSearchSubmitted(buildCarrierQueryString(nextFilters));
    router.push(`/carriers?${query}`);
  }

  function handleClear() {
    router.push("/carriers");
  }

  return (
    <div className="grid gap-4">
      <p className="muted">Search by name, MC/DOT number, compliance status, or equipment type.</p>

      <form className="grid gap-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="grid gap-2">
            <span className="label">Search</span>
            <input
              name="q"
              className="input"
              placeholder="Name, MC number, DOT number, email, or phone"
              defaultValue={filters.q ?? ""}
            />
          </label>

          <label className="grid gap-2">
            <span className="label">Compliance Status</span>
            <select name="complianceStatus" className="select" defaultValue={filters.complianceStatus ?? ""}>
              <option value="">All statuses</option>
              {complianceStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

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
