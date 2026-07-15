"use client";

import { useRouter } from "next/navigation";
import { FormEvent } from "react";
import type { CustomerFilters } from "@/lib/customer-search";
import { buildCustomerQueryString } from "@/lib/customer-search";
import { appendSearchSubmitted } from "@/lib/list-search";

export function CustomerSearchFilters({ filters }: { filters: CustomerFilters }) {
  const router = useRouter();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nextFilters: CustomerFilters = {
      q: String(formData.get("q") ?? "")
    };

    const query = appendSearchSubmitted(buildCustomerQueryString(nextFilters));
    router.push(`/customers?${query}`);
  }

  function handleClear() {
    router.push("/customers");
  }

  return (
    <div className="grid gap-4">
      <p className="muted">Search by name, city, state, or contact details to find customer accounts.</p>

      <form className="grid gap-4" onSubmit={handleSubmit}>
        <label className="grid gap-2">
          <span className="label">Search</span>
          <input
            name="q"
            className="input"
            placeholder="Name, city, state, email, or contact"
            defaultValue={filters.q ?? ""}
          />
        </label>

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
