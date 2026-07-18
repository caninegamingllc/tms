import type { SessionUser } from "@/lib/types";
import { isAdminRole } from "@/lib/scope";

export type CarrierInsuranceCoverageRow = {
  coverageType: string;
  insurerName: string | null;
  policyNumber: string | null;
  expiresAt: Date | null;
};

export type CarrierDnuRow = {
  dnuAt: Date | null;
  dnuMarkedByUserId: string | null;
};

export function isCarrierDnu(carrier: Pick<CarrierDnuRow, "dnuAt">) {
  return carrier.dnuAt != null;
}

export function canClearCarrierDnu(
  user: Pick<SessionUser, "id" | "role">,
  carrier: CarrierDnuRow
) {
  if (!isCarrierDnu(carrier)) {
    return false;
  }

  return isAdminRole(user.role) || carrier.dnuMarkedByUserId === user.id;
}

export function isCoverageDocumentComplete(coverage: CarrierInsuranceCoverageRow) {
  return Boolean(
    coverage.insurerName?.trim() &&
      coverage.policyNumber?.trim() &&
      coverage.expiresAt
  );
}

export function findDocumentCompleteCoverage(
  coverages: CarrierInsuranceCoverageRow[],
  coverageType: string
) {
  return coverages.find(
    (coverage) =>
      coverage.coverageType === coverageType && isCoverageDocumentComplete(coverage)
  );
}

export function validateCarrierDocumentInsurance(coverages: CarrierInsuranceCoverageRow[]) {
  const missing: string[] = [];

  if (!findDocumentCompleteCoverage(coverages, "AUTO_LIABILITY")) {
    missing.push(
      "Auto Liability (BIPD) with underwriter, policy number, and expiration"
    );
  }

  if (!findDocumentCompleteCoverage(coverages, "CARGO")) {
    missing.push("Cargo insurance with underwriter, policy number, and expiration");
  }

  if (missing.length) {
    return { ok: false as const, missing };
  }

  return { ok: true as const };
}

export function carrierDocumentInsuranceErrorMessage(missing: string[]) {
  return `Cannot generate documents: carrier is missing ${missing.join("; ")}.`;
}

export function carrierDnuAssignmentErrorMessage(carrierName: string) {
  return `${carrierName} is marked Do Not Use and cannot be assigned to loads.`;
}

export function assertCarrierDocumentInsuranceReady(
  carrierName: string,
  coverages: CarrierInsuranceCoverageRow[]
) {
  const validation = validateCarrierDocumentInsurance(coverages);
  if (!validation.ok) {
    throw new Error(`${carrierName}: ${carrierDocumentInsuranceErrorMessage(validation.missing)}`);
  }
}
