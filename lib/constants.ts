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
  "CUSTOMER_LOAD_CONFIRMATION",
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

export const oauthProviders = ["GOOGLE", "MICROSOFT"] as const;

export const emailPurposes = [
  "INVOICE",
  "CUSTOMER_LOAD_CONFIRMATION",
  "CARRIER_RATE_CONFIRMATION",
  "BOL",
  "POD_REQUEST",
  "GENERAL"
] as const;

export const emailDirections = ["OUTBOUND", "INBOUND"] as const;

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

export const carrierPayCalculationMethods = ["FLAT", "PER_MILE", "HOURLY"] as const;

export type CarrierPayCalculationMethod = (typeof carrierPayCalculationMethods)[number];

export const driverPayCalculationMethods = ["FLAT", "PER_MILE", "PERCENT_REVENUE"] as const;

export type DriverPayCalculationMethod = (typeof driverPayCalculationMethods)[number];

export const advanceTypes = ["FUEL", "CASH", "OTHER"] as const;

export type AdvanceType = (typeof advanceTypes)[number];

export const advancePayeeTypes = ["DRIVER", "CARRIER"] as const;

export type AdvancePayeeType = (typeof advancePayeeTypes)[number];

export const advanceStatuses = ["OPEN", "APPLIED", "VOID"] as const;

export const driverSettlementStatuses = ["DRAFT", "APPROVED", "PAID", "VOID"] as const;

export const defaultCommodityNames = [
  "General Freight",
  "Produce",
  "Steel",
  "Retail"
] as const;

export const defaultCarrierPayLineTypes = [
  { name: "Flat Rate", calculationMethod: "FLAT" as const, isSystem: true },
  { name: "Rate Per Mile", calculationMethod: "PER_MILE" as const, isSystem: true },
  { name: "Hourly Rate", calculationMethod: "HOURLY" as const, isSystem: true },
  { name: "Detention Pay", calculationMethod: "FLAT" as const, isSystem: true },
  { name: "Stop Off Pay", calculationMethod: "FLAT" as const, isSystem: true },
  { name: "Other Accessorial", calculationMethod: "FLAT" as const, isSystem: true }
] as const;

export const defaultDriverPayLineTypes = [
  { name: "Flat Rate", calculationMethod: "FLAT" as const, isSystem: true },
  { name: "Rate Per Mile", calculationMethod: "PER_MILE" as const, isSystem: true },
  { name: "Percent of Revenue", calculationMethod: "PERCENT_REVENUE" as const, isSystem: true },
  { name: "Detention Pay", calculationMethod: "FLAT" as const, isSystem: true },
  { name: "Other Accessorial", calculationMethod: "FLAT" as const, isSystem: true }
] as const;

export const defaultCustomerChargeTypes = [
  { name: "Flat Rate", calculationMethod: "FLAT" as const, isSystem: true, includeInDriverPay: true },
  { name: "Rate per Mile", calculationMethod: "PER_MILE" as const, isSystem: true, includeInDriverPay: true },
  { name: "Hourly", calculationMethod: "HOURLY" as const, isSystem: true, includeInDriverPay: true },
  { name: "Detention", calculationMethod: "HOURLY" as const, isSystem: true, includeInDriverPay: true },
  { name: "Truck Ordered Not Used", calculationMethod: "FLAT" as const, isSystem: true, includeInDriverPay: true },
  { name: "Permit", calculationMethod: "FLAT" as const, isSystem: true, includeInDriverPay: false },
  { name: "Escort", calculationMethod: "FLAT" as const, isSystem: true, includeInDriverPay: false },
  { name: "Warehouse", calculationMethod: "FLAT" as const, isSystem: true, includeInDriverPay: false }
] as const;

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
