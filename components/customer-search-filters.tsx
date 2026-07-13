"use client";

import { useRouter } from "next/navigation";
import { FormEvent } from "react";
import type { CustomerFilters } from "@/lib/customer-search";
import { buildCustomerQueryString } from "@/lib/customer-search";
import { appendSearchSubmitted } from "@/lib/list-search";

type BranchOption = {
  id: string;
  name: string;
};

export function CustomerSearchFilters({
  filters,
  branches,
  showBranchPicker
}: {
  filters: CustomerFilters;
  branches: BranchOption[];
  showBranchPicker: boolean;
}) {
  const router = useRouter();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nextFilters: CustomerFilters = {
      q: String(formData.get("q") ?? ""),
      branchId: String(formData.get("branchId") ?? "")
    };

    const query = appendSearchSubmitted(buildCustomerQueryString(nextFilters));
    router.push(`/customers?${query}`);
  }

  function handleClear() {
    router.push("/customers");
  }

  return (
    <section className="card p-5">
      <div className="mb-4">
        <h2 className="section-title">Search Customers</h2>
        <p className="muted">Search by name, city, state, or contact details to find customer accounts.</p>
      </div>

      <form className="grid gap-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="label">Search</span>
            <input
              name="q"
              className="input"
              placeholder="Name, city, state, email, or contact"
              defaultValue={filters.q ?? ""}
            />
          </label>

          {showBranchPicker ? (
            <label className="grid gap-2">
              <span className="label">Branch</span>
              <select name="branchId" className="select" defaultValue={filters.branchId ?? ""}>
                <option value="">All branches</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
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
    </section>
  );
}
