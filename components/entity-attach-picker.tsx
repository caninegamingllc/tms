"use client";

import { SearchCombobox, type SearchOption } from "@/components/search-combobox";

export function EntityAttachPicker({
  loads,
  customers,
  carriers,
  defaultLoadId,
  defaultCustomerId,
  defaultCarrierId,
  showLoads = true,
  showCustomers = true,
  showCarriers = true
}: {
  loads: SearchOption[];
  customers: SearchOption[];
  carriers: SearchOption[];
  defaultLoadId?: string;
  defaultCustomerId?: string;
  defaultCarrierId?: string;
  showLoads?: boolean;
  showCustomers?: boolean;
  showCarriers?: boolean;
}) {
  return (
    <div className="grid gap-3">
      {showLoads ? (
        <SearchCombobox
          name="loadId"
          label="Attach to load"
          placeholder="Search load number or title"
          options={loads}
          defaultValue={defaultLoadId}
        />
      ) : null}
      {showCustomers ? (
        <SearchCombobox
          name="customerId"
          label="Attach to customer"
          placeholder="Search customer name"
          options={customers}
          defaultValue={defaultCustomerId}
        />
      ) : null}
      {showCarriers ? (
        <SearchCombobox
          name="carrierId"
          label="Attach to carrier"
          placeholder="Search carrier name"
          options={carriers}
          defaultValue={defaultCarrierId}
        />
      ) : null}
      <p className="muted">
        Select the load, customer, and/or carrier to attach this document to. Leave blank if this is
        your company&apos;s internal document.
      </p>
    </div>
  );
}
