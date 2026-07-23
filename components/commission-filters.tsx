"use client";

import { useRouter } from "next/navigation";
import { FormEvent } from "react";
import type { CommissionFilters } from "@/lib/commission-search";
import { buildCommissionQueryString } from "@/lib/commission-search";
import { commissionStatuses } from "@/lib/constants";
import { humanize } from "@/lib/format";
import { DatePicker } from "@/components/ui/date-picker";

export function CommissionFilters({ filters }: { filters: CommissionFilters }) {
  const router = useRouter();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nextFilters: CommissionFilters = {
      status: String(formData.get("status") ?? "") as CommissionFilters["status"],
      commissionable: String(formData.get("commissionable") ?? "") as CommissionFilters["commissionable"],
      dateFrom: String(formData.get("dateFrom") ?? ""),
      dateTo: String(formData.get("dateTo") ?? "")
    };

    const query = buildCommissionQueryString(nextFilters);
    router.push(query ? `/commissions?${query}` : "/commissions");
  }

  function handleClear() {
    router.push("/commissions");
  }

  return (
    <div className="grid gap-4">
      <p className="muted">Filter by settlement status, commissionable flag, and pickup date.</p>

      <form className="grid gap-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-2">
            <span className="label">Settlement Status</span>
            <select name="status" className="select" defaultValue={filters.status ?? ""}>
              <option value="">All statuses</option>
              {commissionStatuses.map((status) => (
                <option key={status} value={status}>
                  {humanize(status)}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="label">Commissionable</span>
            <select name="commissionable" className="select" defaultValue={filters.commissionable ?? ""}>
              <option value="">All loads</option>
              <option value="yes">Commissionable</option>
              <option value="no">Non-commissionable</option>
            </select>
          </label>

          <label className="grid gap-2">
            <span className="label">Pickup From</span>
            <DatePicker name="dateFrom" defaultValue={filters.dateFrom ?? ""} placeholder="Pickup from" />
          </label>

          <label className="grid gap-2">
            <span className="label">Pickup To</span>
            <DatePicker name="dateTo" defaultValue={filters.dateTo ?? ""} placeholder="Pickup to" />
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn">
            Apply Filters
          </button>
          <button type="button" className="btn-secondary" onClick={handleClear}>
            Clear
          </button>
        </div>
      </form>
    </div>
  );
}
