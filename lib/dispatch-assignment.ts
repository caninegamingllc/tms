/** Helpers for multi-carrier DispatchAssignment rows (sequence 0 = primary). */

import { pendingLoadStatuses, preDispatchLoadStatuses } from "@/lib/constants";

export type AssignmentLike = {
  id: string;
  sequence: number;
  carrierId?: string | null;
  rateCents?: number;
  carrier?: { name: string } | null;
  originCity?: string | null;
  originState?: string | null;
  destinationCity?: string | null;
  destinationState?: string | null;
};

export const dispatchAssignmentsInclude = {
  orderBy: { sequence: "asc" as const },
  include: {
    carrier: true,
    payLines: {
      orderBy: { sortOrder: "asc" as const },
      include: { lineType: true }
    },
    checkCalls: { orderBy: { occurredAt: "desc" as const } }
  }
};

export function sortAssignments<T extends { sequence: number }>(assignments: T[]): T[] {
  return [...assignments].sort((a, b) => a.sequence - b.sequence);
}

export function primaryAssignment<T extends { sequence: number }>(
  assignments: T[] | undefined | null
): T | null {
  if (!assignments?.length) return null;
  const sorted = sortAssignments(assignments);
  return sorted.find((a) => a.sequence === 0) ?? sorted[0] ?? null;
}

export function carrierAssignments<T extends { carrierId?: string | null }>(
  assignments: T[] | undefined | null
): T[] {
  if (!assignments?.length) return [];
  return assignments.filter((a) => Boolean(a.carrierId));
}

export function hasAssignmentOriginDestination(assignment: {
  originCity?: string | null;
  originState?: string | null;
  destinationCity?: string | null;
  destinationState?: string | null;
}): boolean {
  return Boolean(
    assignment.originCity?.trim() &&
      assignment.originState?.trim() &&
      assignment.destinationCity?.trim() &&
      assignment.destinationState?.trim()
  );
}

export function carrierDisplayName(assignments: AssignmentLike[] | undefined | null): string {
  const withCarrier = carrierAssignments(assignments ?? []);
  if (withCarrier.length === 0) return "Uncovered";
  const primary = primaryAssignment(withCarrier) ?? withCarrier[0];
  const name = primary?.carrier?.name ?? "Carrier";
  const extra = withCarrier.length - 1;
  return extra > 0 ? `${name} +${extra}` : name;
}

export function sumAssignmentRateCents(
  assignments: Array<{ rateCents?: number }> | undefined | null
): number {
  if (!assignments?.length) return 0;
  return assignments.reduce((sum, a) => sum + (a.rateCents ?? 0), 0);
}

export function nextAssignmentSequence(assignments: Array<{ sequence: number }>): number {
  if (!assignments.length) return 0;
  return Math.max(...assignments.map((a) => a.sequence)) + 1;
}

export type DispatchedCoverageAssignment = {
  sequence: number;
  carrierId?: string | null;
  driverId?: string | null;
  truckId?: string | null;
};

/** True if the load may be marked DISPATCHED: any carrier, or fleet driver+truck on primary. */
export function loadHasDispatchedCoverage(
  assignments: DispatchedCoverageAssignment[] | undefined | null
): boolean {
  if (!assignments?.length) return false;
  if (assignments.some((row) => Boolean(row.carrierId))) return true;
  const primary = primaryAssignment(assignments);
  return Boolean(primary?.driverId && primary?.truckId);
}

export const DISPATCHED_COVERAGE_REQUIRED_MESSAGE =
  "Cannot mark a load as Dispatched without a carrier assigned, or a driver and truck assigned for fleet.";

export const PENDING_REVERT_CONFIRM_MESSAGE =
  "Move this load to Pending? All assigned carriers, fleet resources, and pay line items will be removed.";

export const UNASSIGN_CARRIER_CONFIRM_MESSAGE =
  "Unassign this carrier? Pay lines for this carrier will be removed. If the load is no longer covered, status will move to Pending.";

export function isPendingLoadStatus(status: string): boolean {
  return (pendingLoadStatuses as readonly string[]).includes(status);
}

/** When coverage is assigned, advance early statuses to DISPATCHED. */
export function statusAfterCoverageAssigned(currentStatus: string): string {
  return (preDispatchLoadStatuses as readonly string[]).includes(currentStatus)
    ? "DISPATCHED"
    : currentStatus;
}

const terminalLoadStatuses = ["INVOICED", "PAID", "CANCELED"] as const;

/** When last coverage is removed, uncovered non-terminal loads become PENDING. */
export function statusAfterCoverageCleared(currentStatus: string): string {
  if ((terminalLoadStatuses as readonly string[]).includes(currentStatus)) {
    return currentStatus;
  }
  return "PENDING";
}

/** Shared Prisma include for load detail / documents. */
export const dispatchAssignmentsDocumentInclude = {
  orderBy: { sequence: "asc" as const },
  include: {
    carrier: { include: { contacts: true } },
    payLines: {
      orderBy: { sortOrder: "asc" as const },
      include: { lineType: true }
    }
  }
};

export function parseAssignmentLaneFields(formData: FormData) {
  const trim = (key: string) => {
    const value = String(formData.get(key) ?? "").trim();
    return value || null;
  };
  return {
    originFacilityName: trim("originFacilityName"),
    originCity: trim("originCity"),
    originState: trim("originState"),
    originPostalCode: trim("originPostalCode"),
    destinationFacilityName: trim("destinationFacilityName"),
    destinationCity: trim("destinationCity"),
    destinationState: trim("destinationState"),
    destinationPostalCode: trim("destinationPostalCode")
  };
}
