"use client";

import { useState } from "react";
import { equipmentTypes } from "@/lib/constants";

export function EquipmentFields({
  defaultEquipmentType = "Dry Van",
  defaultReeferTempF
}: {
  defaultEquipmentType?: string;
  defaultReeferTempF?: number | null;
}) {
  const [equipmentType, setEquipmentType] = useState(defaultEquipmentType);
  const isReefer = equipmentType === "Reefer";

  return (
    <>
      <label className="grid gap-2">
        <span className="label">Equipment</span>
        <select
          name="equipmentType"
          className="select"
          value={equipmentType}
          onChange={(event) => setEquipmentType(event.target.value)}
        >
          {equipmentTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>
      {isReefer ? (
        <label className="grid gap-2">
          <span className="label">Required Temp (°F)</span>
          <input
            name="reeferTempF"
            className="input"
            type="number"
            step="any"
            defaultValue={defaultReeferTempF ?? ""}
            placeholder="e.g. 34"
            required
          />
        </label>
      ) : null}
    </>
  );
}
