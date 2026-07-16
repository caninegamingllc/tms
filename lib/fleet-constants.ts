export const DRIVER_STATUSES = ["ACTIVE", "INACTIVE", "TERMINATED"] as const;
export const ASSET_STATUSES = ["ACTIVE", "INACTIVE", "OUT_OF_SERVICE", "SHOP"] as const;
export const TRUCK_OWNERSHIPS = ["COMPANY", "OWNER_OPERATOR"] as const;
export const MAINTENANCE_WORK_TYPES = ["PM", "REPAIR", "INSPECTION", "OTHER"] as const;
export const SAFETY_EVENT_TYPES = [
  "ACCIDENT",
  "INCIDENT",
  "ROADSIDE",
  "VIOLATION",
  "OTHER"
] as const;

export const DQF_CATEGORIES = [
  { id: "APPLICATION", title: "Application for employment", required: true },
  { id: "MVR", title: "Motor vehicle record (MVR)", required: true },
  { id: "ROAD_TEST", title: "Road test / certificate", required: true },
  { id: "MEDICAL_CARD", title: "Medical examiner certificate", required: true },
  { id: "CDL_COPY", title: "CDL copy", required: true },
  { id: "CLEARINGHOUSE", title: "Drug & alcohol clearinghouse / tests", required: true },
  { id: "PRIOR_EMPLOYER", title: "Previous employer safety inquiry", required: true },
  { id: "ANNUAL_VIOLATIONS", title: "Annual certification of violations", required: true },
  { id: "TRAINING", title: "Training certificates", required: false },
  { id: "OTHER", title: "Other qualification document", required: false }
] as const;

export const TRAILER_TYPES = [
  "Dry Van",
  "Reefer",
  "Flatbed",
  "Step Deck",
  "Lowboy",
  "Tanker",
  "Other"
] as const;

export const ELD_INTEGRATION_PROVIDERS = ["SAMSARA", "MOTIVE", "GEOTAB"] as const;

export const ELD_STARTER_INTEGRATIONS = [
  [
    "SAMSARA",
    "Samsara ELD",
    "Phase 2: GPS location, HOS, and asset visibility via Samsara API."
  ],
  [
    "MOTIVE",
    "Motive ELD",
    "Phase 2: GPS location, HOS, and asset visibility via Motive (KeepTruckin) API."
  ],
  [
    "GEOTAB",
    "Geotab ELD",
    "Phase 2: GPS location, HOS, and asset visibility via Geotab API."
  ]
] as const;

export function driverDisplayName(driver: { firstName: string; lastName: string }) {
  return `${driver.firstName} ${driver.lastName}`.trim();
}

export function daysUntil(date: Date | null | undefined): number | null {
  if (!date) return null;
  const ms = new Date(date).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function expirationBucket(
  date: Date | null | undefined
): "expired" | "30" | "60" | "90" | "ok" | "none" {
  const days = daysUntil(date);
  if (days == null) return "none";
  if (days < 0) return "expired";
  if (days <= 30) return "30";
  if (days <= 60) return "60";
  if (days <= 90) return "90";
  return "ok";
}
