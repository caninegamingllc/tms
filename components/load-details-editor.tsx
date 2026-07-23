"use client";

import { useState, type ReactNode } from "react";
import {
  CustomerChargeLinesEditor,
  type ChargeTypeOption,
  type InitialCustomerCharge
} from "@/components/customer-charge-lines-editor";
import { EquipmentFields } from "@/components/equipment-fields";
import {
  FreightLinesEditor,
  type InitialFreightLine
} from "@/components/freight-lines-editor";
import { LoadStopsEditor } from "@/components/load-stops-editor";
import { SearchCombobox, type SearchOption } from "@/components/search-combobox";
import { updateLoad } from "@/lib/actions";
import { formatMoney } from "@/lib/format";

type FacilityOption = SearchOption & {
  address?: string | null;
  city: string;
  state: string;
  postalCode?: string | null;
};

type StopView = {
  id: string;
  type: string;
  sequence: number;
  facilityId: string | null;
  facilityName: string;
  address: string | null;
  city: string;
  state: string;
  postalCode: string | null;
  appointmentAt: Date | string | null;
  appointmentEndAt?: Date | string | null;
  instructions: string | null;
};

type ChargeView = {
  id: string;
  label: string;
  chargeType: string;
  description: string | null;
  unitRateCents: number;
  quantity: number;
  amountCents: number;
  lineTypeId: string | null;
};

function formatDims(line: InitialFreightLine) {
  const parts = [line.lengthIn, line.widthIn, line.heightIn]
    .filter((value) => value != null)
    .map((value) => `${value}"`);
  return parts.length ? parts.join(" × ") : null;
}

function moneyInput(cents: number) {
  if (!cents) {
    return "";
  }
  return (cents / 100).toFixed(2).replace(/\.00$/, "");
}

export function LoadDetailsEditor({
  loadId,
  writable,
  customerId,
  customerName,
  customerOptions,
  branchId,
  branches,
  canPickBranch,
  referenceNumber,
  equipmentType,
  reeferTempF,
  revenueCents,
  carrierCostCents,
  commodity,
  weight,
  freightLines,
  descriptionSuggestions,
  chargeTypes,
  charges,
  defaultMiles,
  stops,
  facilities,
  statusBadge,
  marginLabel,
  marginPercentLabel
}: {
  loadId: string;
  writable: boolean;
  customerId: string;
  customerName: string;
  customerOptions: SearchOption[];
  branchId: string | null;
  branches: Array<{ id: string; name: string }>;
  canPickBranch: boolean;
  referenceNumber: string | null;
  equipmentType: string;
  reeferTempF: number | null;
  revenueCents: number;
  carrierCostCents: number;
  commodity: string | null;
  weight: number | null;
  freightLines: InitialFreightLine[];
  descriptionSuggestions: string[];
  chargeTypes: ChargeTypeOption[];
  charges: ChargeView[];
  defaultMiles?: number | null;
  stops: StopView[];
  facilities: FacilityOption[];
  statusBadge: ReactNode;
  marginLabel: string;
  marginPercentLabel: string;
}) {
  const [editing, setEditing] = useState(false);

  const editableCharges = charges.filter((charge) => charge.chargeType !== "Late Fee");
  const lateFeeCharges = charges.filter((charge) => charge.chargeType === "Late Fee");
  const initialChargeLines: InitialCustomerCharge[] = editableCharges
    .filter((charge) => charge.lineTypeId)
    .map((charge) => ({
      lineTypeId: charge.lineTypeId as string,
      description: charge.description,
      unitRateCents: charge.unitRateCents || charge.amountCents,
      quantity: charge.quantity || 1,
      amountCents: charge.amountCents
    }));

  if (!editing || !writable) {
    return (
      <div className="grid gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xl font-semibold text-foreground">{customerName}</p>
            <div className="mt-2">{statusBadge}</div>
            <p className="mt-3 muted">
              {equipmentType}
              {equipmentType === "Reefer" && reeferTempF != null ? ` @ ${reeferTempF}°F` : ""} -{" "}
              {commodity ?? "General freight"} -{" "}
              {weight ? `${weight.toLocaleString()} lbs` : "Weight TBD"}
              {stops.length > 2 ? ` · ${stops.length} stops` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-4">
            <div className="grid gap-1 text-right">
              <span className="text-sm text-muted-foreground">Gross margin</span>
              <span className="text-2xl font-bold text-foreground">{marginLabel}</span>
              <span className="text-sm text-muted-foreground">{marginPercentLabel}</span>
            </div>
            {writable ? (
              <button type="button" className="btn-secondary" onClick={() => setEditing(true)}>
                Edit details
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-muted p-4 md:col-span-1">
            <p className="label">Customer Rate</p>
            <p className="mt-2 text-xl font-semibold">{formatMoney(revenueCents)}</p>
            {charges.length > 0 ? (
              <ul className="mt-3 grid gap-1 text-sm text-muted-foreground">
                {charges.map((charge) => (
                  <li key={charge.id} className="flex justify-between gap-3">
                    <span>
                      {charge.label}
                      {charge.quantity !== 1 && charge.chargeType !== "Late Fee"
                        ? ` × ${charge.quantity}`
                        : ""}
                    </span>
                    <span className="font-medium text-foreground">
                      {formatMoney(charge.amountCents)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="rounded-2xl bg-muted p-4">
            <p className="label">Carrier Cost</p>
            <p className="mt-2 text-xl font-semibold">{formatMoney(carrierCostCents)}</p>
          </div>
          <div className="rounded-2xl bg-muted p-4">
            <p className="label">Reference</p>
            <p className="mt-2 text-xl font-semibold">{referenceNumber ?? "None"}</p>
          </div>
        </div>

        {freightLines.length ? (
          <div className="grid gap-2">
            <p className="label">Freight lines</p>
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Qty</th>
                    <th className="px-3 py-2 font-semibold">Description</th>
                    <th className="px-3 py-2 font-semibold">Weight</th>
                    <th className="px-3 py-2 font-semibold">Pieces / Pallets</th>
                    <th className="px-3 py-2 font-semibold">Dims (in)</th>
                  </tr>
                </thead>
                <tbody>
                  {freightLines.map((line, index) => (
                    <tr key={`${line.description}-${index}`} className="border-t border-border">
                      <td className="px-3 py-2">{line.quantity}</td>
                      <td className="px-3 py-2 font-medium text-foreground">{line.description}</td>
                      <td className="px-3 py-2">{line.weightLbs.toLocaleString()} lbs</td>
                      <td className="px-3 py-2">{line.pieces || "—"}</td>
                      <td className="px-3 py-2">{formatDims(line) || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <form action={updateLoad} className="grid gap-6">
      <input type="hidden" name="loadId" value={loadId} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Edit load details</h3>
          <p className="muted text-sm">Update PO, equipment, rates, freight lines, and stops.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={() => setEditing(false)}>
            Cancel
          </button>
          <button type="submit" className="btn">
            Save load details
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SearchCombobox
          name="customerId"
          label="Customer"
          placeholder="Search customers"
          options={customerOptions}
          defaultValue={customerId}
          required
        />
        <label className="grid gap-2">
          <span className="label">Customer Reference</span>
          <input
            name="referenceNumber"
            className="input"
            defaultValue={referenceNumber ?? ""}
            placeholder="PO / tender number"
          />
        </label>
      </div>

      {canPickBranch ? (
        <label className="grid gap-2 md:max-w-sm">
          <span className="label">Branch</span>
          <select name="branchId" className="select" defaultValue={branchId ?? ""}>
            <option value="">Default to your branch</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <input type="hidden" name="branchId" value={branchId ?? ""} />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <EquipmentFields defaultEquipmentType={equipmentType} defaultReeferTempF={reeferTempF} />
        <label className="grid gap-2">
          <span className="label">Estimated Carrier Cost</span>
          <input
            name="carrierCost"
            className="input"
            defaultValue={moneyInput(carrierCostCents)}
            placeholder="1900"
          />
        </label>
      </div>

      <div className="grid gap-3">
        <div>
          <h4 className="text-sm font-semibold text-foreground">Customer charges</h4>
          <p className="muted text-sm">
            Add line items with charge type, quantity, and amount. Total becomes customer rate.
          </p>
        </div>
        <CustomerChargeLinesEditor
          lineTypes={chargeTypes}
          initialLines={initialChargeLines}
          defaultMiles={defaultMiles}
        />
        {lateFeeCharges.length ? (
          <p className="text-sm text-muted-foreground">
            Late fees ({formatMoney(lateFeeCharges.reduce((sum, c) => sum + c.amountCents, 0))}) stay
            on the load and are not edited here.
          </p>
        ) : null}
      </div>

      <div className="grid gap-3">
        <div>
          <h4 className="text-sm font-semibold text-foreground">Freight lines</h4>
          <p className="muted text-sm">Quantity, description, and weight are required on each line.</p>
        </div>
        <FreightLinesEditor
          initialLines={freightLines}
          descriptionSuggestions={descriptionSuggestions}
        />
      </div>

      <LoadStopsEditor facilities={facilities} initialStops={stops} />

      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={() => setEditing(false)}>
          Cancel
        </button>
        <button type="submit" className="btn">
          Save load details
        </button>
      </div>
    </form>
  );
}
