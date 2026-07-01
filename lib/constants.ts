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
  "INSURANCE",
  "W9",
  "OTHER"
] as const;

export const paymentStatuses = [
  "DRAFT",
  "SENT",
  "APPROVED",
  "PARTIAL",
  "PAID",
  "OVERDUE",
  "VOID"
] as const;

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
