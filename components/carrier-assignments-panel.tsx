"use client";

import { useState } from "react";
import { assignCarrier, unassignCarrier, generateRateConfirmation } from "@/lib/actions";
import { CarrierPayLinesEditor, type InitialPayLine, type PayLineTypeOption } from "@/components/carrier-pay-lines-editor";
import { SearchCombobox } from "@/components/search-combobox";
import { EmailComposeButton } from "@/components/email-compose-button";
import { formatMoney } from "@/lib/format";

export type CarrierOption = {
  id: string;
  label: string;
  description?: string;
};

export type AssignmentBlock = {
  id: string;
  sequence: number;
  carrierId: string | null;
  carrierName: string | null;
  rateCents: number;
  driverName: string | null;
  driverPhone: string | null;
  truckNumber: string | null;
  trailerNumber: string | null;
  originFacilityName: string | null;
  originCity: string | null;
  originState: string | null;
  originPostalCode: string | null;
  destinationFacilityName: string | null;
  destinationCity: string | null;
  destinationState: string | null;
  destinationPostalCode: string | null;
  payLines: InitialPayLine[];
};

function LaneFields({
  assignment,
  required
}: {
  assignment?: AssignmentBlock | null;
  required?: boolean;
}) {
  return (
    <div className="grid gap-3 rounded-2xl border border-border bg-muted/40 p-3">
      <p className="text-sm font-semibold text-foreground">
        Carrier lane{required ? " (required)" : " (optional — blank uses load stops on rate con)"}
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid gap-2">
          <span className="label">Origin</span>
          <input
            name="originFacilityName"
            className="input"
            placeholder="Facility name"
            defaultValue={assignment?.originFacilityName ?? ""}
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              name="originCity"
              className="input col-span-2"
              placeholder="City"
              defaultValue={assignment?.originCity ?? ""}
              required={required}
            />
            <input
              name="originState"
              className="input"
              placeholder="ST"
              defaultValue={assignment?.originState ?? ""}
              required={required}
            />
          </div>
          <input
            name="originPostalCode"
            className="input"
            placeholder="Postal"
            defaultValue={assignment?.originPostalCode ?? ""}
          />
        </div>
        <div className="grid gap-2">
          <span className="label">Destination</span>
          <input
            name="destinationFacilityName"
            className="input"
            placeholder="Facility name"
            defaultValue={assignment?.destinationFacilityName ?? ""}
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              name="destinationCity"
              className="input col-span-2"
              placeholder="City"
              defaultValue={assignment?.destinationCity ?? ""}
              required={required}
            />
            <input
              name="destinationState"
              className="input"
              placeholder="ST"
              defaultValue={assignment?.destinationState ?? ""}
              required={required}
            />
          </div>
          <input
            name="destinationPostalCode"
            className="input"
            placeholder="Postal"
            defaultValue={assignment?.destinationPostalCode ?? ""}
          />
        </div>
      </div>
    </div>
  );
}

function AssignmentForm({
  loadId,
  carrierOptions,
  lineTypes,
  defaultMiles,
  assignment,
  isAdditional,
  showDriverFields,
  canWrite,
  canEmail,
  canGenerateRateCon,
  mailboxConnected,
  locked
}: {
  loadId: string;
  carrierOptions: CarrierOption[];
  lineTypes: PayLineTypeOption[];
  defaultMiles?: number | null;
  assignment?: AssignmentBlock | null;
  isAdditional: boolean;
  showDriverFields: boolean;
  canWrite: boolean;
  canEmail: boolean;
  canGenerateRateCon: boolean;
  mailboxConnected: boolean;
  locked: boolean;
}) {
  const title = isAdditional
    ? assignment?.carrierName
      ? `Additional carrier: ${assignment.carrierName}`
      : "Additional carrier"
    : `Primary carrier: ${assignment?.carrierName ?? "Not covered"}`;

  return (
    <div className="grid gap-3 rounded-2xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-foreground">{title}</p>
        {assignment ? (
          <p className="text-sm text-muted-foreground">{formatMoney(assignment.rateCents)}</p>
        ) : null}
      </div>

      <form
        key={assignment?.id ?? (isAdditional ? "new-additional" : "new-primary")}
        action={assignCarrier}
        className="grid gap-3"
      >
        <input type="hidden" name="loadId" value={loadId} />
        {assignment?.id ? <input type="hidden" name="assignmentId" value={assignment.id} /> : null}
        {isAdditional ? <input type="hidden" name="isAdditional" value="1" /> : null}
        <SearchCombobox
          name="carrierId"
          label="Carrier"
          placeholder="Search carriers"
          options={carrierOptions}
          defaultValue={assignment?.carrierId ?? ""}
          required
        />
        {isAdditional ||
        (assignment &&
          (assignment.originCity ||
            assignment.destinationCity ||
            assignment.sequence > 0)) ? (
          <LaneFields assignment={assignment} required={isAdditional} />
        ) : null}
        <div className="grid gap-2">
          <span className="label">Payment line items</span>
          <CarrierPayLinesEditor
            lineTypes={lineTypes}
            initialLines={assignment?.payLines ?? []}
            defaultMiles={isAdditional ? null : defaultMiles}
          />
        </div>
        {showDriverFields && !isAdditional ? (
          <>
            <input
              name="driverName"
              className="input"
              placeholder="Driver name"
              defaultValue={assignment?.driverName ?? ""}
            />
            <input
              name="driverPhone"
              className="input"
              placeholder="Driver phone"
              defaultValue={assignment?.driverPhone ?? ""}
            />
            <div className="grid gap-3 md:grid-cols-2">
              <input
                name="truckNumber"
                className="input"
                placeholder="Truck #"
                defaultValue={assignment?.truckNumber ?? ""}
              />
              <input
                name="trailerNumber"
                className="input"
                placeholder="Trailer #"
                defaultValue={assignment?.trailerNumber ?? ""}
              />
            </div>
          </>
        ) : null}
        {canWrite && !locked ? (
          <button type="submit" className="btn">
            {assignment ? "Save carrier assignment" : "Assign carrier"}
          </button>
        ) : null}
      </form>

      {assignment?.carrierId && canWrite && !locked ? (
        <div className="flex flex-wrap gap-2">
          {canGenerateRateCon ? (
            <form action={generateRateConfirmation}>
              <input type="hidden" name="loadId" value={loadId} />
              <input type="hidden" name="assignmentId" value={assignment.id} />
              <button type="submit" className="btn-secondary">
                Generate Rate Con
              </button>
            </form>
          ) : null}
          {canEmail ? (
            <EmailComposeButton
              loadId={loadId}
              purpose="CARRIER_RATE_CONFIRMATION"
              label="Email Rate Con"
              className="btn-secondary"
              disabled={!mailboxConnected}
              assignmentId={assignment.id}
            />
          ) : null}
          <form action={unassignCarrier}>
            <input type="hidden" name="loadId" value={loadId} />
            <input type="hidden" name="assignmentId" value={assignment.id} />
            <button type="submit" className="btn-secondary">
              Unassign
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

export function CarrierAssignmentsPanel({
  loadId,
  carrierOptions,
  lineTypes,
  defaultMiles,
  assignments,
  hasFleetDispatch,
  canWrite,
  canEmail,
  canGenerateRateCon,
  mailboxConnected,
  locked
}: {
  loadId: string;
  carrierOptions: CarrierOption[];
  lineTypes: PayLineTypeOption[];
  defaultMiles?: number | null;
  assignments: AssignmentBlock[];
  hasFleetDispatch: boolean;
  canWrite: boolean;
  canEmail: boolean;
  canGenerateRateCon: boolean;
  mailboxConnected: boolean;
  locked: boolean;
}) {
  const primary = assignments.find((row) => row.sequence === 0) ?? null;
  const additional = assignments.filter((row) => row.sequence > 0);
  const [showAdditional, setShowAdditional] = useState(additional.length > 0);
  const [draftSlots, setDraftSlots] = useState(0);

  const newFormCount = showAdditional
    ? additional.length === 0
      ? Math.max(1, draftSlots)
      : draftSlots
    : 0;

  return (
    <div className="grid gap-4">
      <AssignmentForm
        loadId={loadId}
        carrierOptions={carrierOptions}
        lineTypes={lineTypes}
        defaultMiles={defaultMiles}
        assignment={primary}
        isAdditional={false}
        showDriverFields={!hasFleetDispatch}
        canWrite={canWrite}
        canEmail={canEmail}
        canGenerateRateCon={canGenerateRateCon}
        mailboxConnected={mailboxConnected}
        locked={locked}
      />

      {canWrite && !locked ? (
        <label className="inline-flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border"
            checked={showAdditional}
            onChange={(event) => {
              const checked = event.target.checked;
              setShowAdditional(checked);
              if (!checked) {
                setDraftSlots(0);
              } else if (additional.length === 0) {
                setDraftSlots(1);
              }
            }}
          />
          Assign additional carrier
        </label>
      ) : additional.length > 0 ? (
        <p className="text-sm font-semibold text-foreground">Additional carriers</p>
      ) : null}

      {(showAdditional || additional.length > 0) &&
        additional.map((assignment) => (
          <AssignmentForm
            key={assignment.id}
            loadId={loadId}
            carrierOptions={carrierOptions}
            lineTypes={lineTypes}
            defaultMiles={defaultMiles}
            assignment={assignment}
            isAdditional
            showDriverFields={false}
            canWrite={canWrite}
            canEmail={canEmail}
            canGenerateRateCon={canGenerateRateCon}
            mailboxConnected={mailboxConnected}
            locked={locked}
          />
        ))}

      {Array.from({ length: newFormCount }).map((_, index) => (
        <AssignmentForm
          key={`draft-${index}`}
          loadId={loadId}
          carrierOptions={carrierOptions}
          lineTypes={lineTypes}
          defaultMiles={defaultMiles}
          assignment={null}
          isAdditional
          showDriverFields={false}
          canWrite={canWrite}
          canEmail={canEmail}
          canGenerateRateCon={canGenerateRateCon}
          mailboxConnected={mailboxConnected}
          locked={locked}
        />
      ))}

      {showAdditional && canWrite && !locked ? (
        <button
          type="button"
          className="btn-secondary justify-self-start"
          onClick={() =>
            setDraftSlots((count) => (additional.length === 0 && count < 1 ? 2 : count + 1))
          }
        >
          Add another carrier
        </button>
      ) : null}
    </div>
  );
}
