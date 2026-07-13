export const loadStatuses = [
  "QUOTE",
  "AVAILABLE",
  "COVERED",
  "DISPATCHED",
  "PICKED_UP",
  "DELIVERED",
  "INVOICED",
  "PAID",
  "CANCELED"
] as const;

export const equipmentTypes = [
  "Dry Van",
  "Reefer",
  "Flatbed",
  "Step Deck",
  "Power Only",
  "Box Truck"
];

export const documentTypes = [
  "BOL",
  "POD",
  "RATE_CONFIRMATION",
  "INVOICE",
  "CARRIER_PACKET",
  "DOT_MC_FF_URS",
  "NOA",
  "W9",
  "INSURANCE_PROOF",
  "BROKER_CONTRACT",
  "INSURANCE",
  "OTHER"
] as const;

export const documentStatuses = ["UPLOADED", "PROCESSED"] as const;

export const paymentStatuses = [
  "DRAFT",
  "SENT",
  "APPROVED",
  "PARTIAL",
  "PAID",
  "OVERDUE",
  "VOID"
] as const;

export const commissionStatuses = ["PENDING", "PAYABLE", "SETTLED", "INELIGIBLE"] as const;

export const commissionCalculationMethods = [
  "STANDARD_SPLIT",
  "EXPENSE_FLOOR",
  "INELIGIBLE",
  "NO_PROFIT"
] as const;

export const expenseTypes = ["Lumper", "Detention", "TONU", "Other"] as const;

export type CommissionStatus = (typeof commissionStatuses)[number];
export type CommissionCalculationMethod = (typeof commissionCalculationMethods)[number];

export const userRoles = ["OWNER", "ADMIN", "BROKER", "DISPATCHER", "ACCOUNTING", "VIEWER"] as const;

export const userStatuses = ["ACTIVE", "LOCKED", "DISABLED", "INVITED"] as const;

export const facilityTypes = ["GENERAL", "SHIPPER", "CONSIGNEE", "DISTRIBUTION_CENTER", "PORT", "RAIL"] as const;

export const insuranceCoverageTypes = [
  "AUTO_LIABILITY",
  "CARGO",
  "GENERAL_LIABILITY",
  "WORKERS_COMP",
  "TRAILER_INTERCHANGE",
  "OTHER"
] as const;
