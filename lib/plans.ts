export const PLAN_IDS = ["FREE", "LITE", "PREMIUM", "PREMIUM_TRUCKING"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

/** Core brokerage features shared by Premium (and below as gated). */
export const CORE_PLAN_FEATURES = [
  "dashboard_basic",
  "dashboard_fuel_index",
  "loads_create",
  "loads_full_status",
  "dispatch",
  "carrier_assign",
  "check_calls",
  "load_notes",
  "route_map",
  "search",
  "search_export",
  "customers_basic",
  "customers_full",
  "carriers_basic",
  "carriers_full",
  "fmcsa_lookup",
  "locations",
  "business_search",
  "crm_documents_activity",
  "factoring_assignment",
  "documents_upload",
  "generate_rate_con",
  "generate_load_con",
  "generate_bol",
  "generate_invoice_pdf",
  "pdf_worker_bulk",
  "accounting_ar_ap",
  "accounting_aging",
  "late_fees",
  "bulk_invoice_email",
  "factoring_admin",
  "commissions",
  "customer_portal",
  "email_mailbox",
  "email_ops",
  "quickbooks_iif",
  "quickbooks_online",
  "reports_summary",
  "reports_full",
  "marketplace_integrations",
  "invite_users",
  "multi_branch",
  "audit_log",
  "branding_full",
  "catalogs_manage",
  "delete_loads"
] as const;

/** Trucking-only features — Premium + Trucking exclusively. */
export const TRUCKING_PLAN_FEATURES = [
  "fleet_assets",
  "fleet_dispatch",
  "driver_qualification",
  "safety_records",
  "eld_integrations",
  "fuel_tax_ifta"
] as const;

export const PLAN_FEATURES = [...CORE_PLAN_FEATURES, ...TRUCKING_PLAN_FEATURES] as const;

export type PlanFeature = (typeof PLAN_FEATURES)[number];
export type TruckingPlanFeature = (typeof TRUCKING_PLAN_FEATURES)[number];

export type PlanDefinition = {
  id: PlanId;
  name: string;
  /** Per-seat monthly price in cents (Free is $0). */
  priceMonthlyCents: number;
  /** Max purchasable seats for the plan. null = no purchase cap. */
  maxSeats: number | null;
  /** Soft cap on loads created per calendar month (Free only). null = unlimited. */
  monthlyLoadCap: number | null;
  features: readonly PlanFeature[];
};

const FREE_FEATURES = [
  "dashboard_basic",
  "loads_create",
  "carrier_assign",
  "check_calls",
  "customers_basic",
  "carriers_basic"
] as const satisfies readonly PlanFeature[];

const LITE_FEATURES = [
  ...FREE_FEATURES,
  "dashboard_fuel_index",
  "loads_full_status",
  "dispatch",
  "load_notes",
  "search",
  "customers_full",
  "carriers_full",
  "fmcsa_lookup",
  "locations",
  "crm_documents_activity",
  "factoring_assignment",
  "documents_upload",
  "generate_rate_con",
  "generate_load_con",
  "generate_bol",
  "generate_invoice_pdf",
  "accounting_ar_ap",
  "accounting_aging",
  "factoring_admin",
  "quickbooks_iif",
  "reports_summary",
  "invite_users",
  "branding_full",
  "catalogs_manage",
  "delete_loads"
] as const satisfies readonly PlanFeature[];

/** All core features — explicitly not trucking. */
const PREMIUM_FEATURES = [...CORE_PLAN_FEATURES] as const satisfies readonly PlanFeature[];

const PREMIUM_TRUCKING_FEATURES = [
  ...PREMIUM_FEATURES,
  ...TRUCKING_PLAN_FEATURES
] as const satisfies readonly PlanFeature[];

export const PLANS: Record<PlanId, PlanDefinition> = {
  FREE: {
    id: "FREE",
    name: "Free",
    priceMonthlyCents: 0,
    maxSeats: 1,
    monthlyLoadCap: 25,
    features: FREE_FEATURES
  },
  LITE: {
    id: "LITE",
    name: "Lite",
    priceMonthlyCents: 2000,
    maxSeats: 5,
    monthlyLoadCap: null,
    features: LITE_FEATURES
  },
  PREMIUM: {
    id: "PREMIUM",
    name: "Premium",
    priceMonthlyCents: 6000,
    maxSeats: null,
    monthlyLoadCap: null,
    features: PREMIUM_FEATURES
  },
  PREMIUM_TRUCKING: {
    id: "PREMIUM_TRUCKING",
    name: "Premium + Trucking",
    priceMonthlyCents: 10000,
    maxSeats: null,
    monthlyLoadCap: null,
    features: PREMIUM_TRUCKING_FEATURES
  }
};

export function isPlanId(value: string | null | undefined): value is PlanId {
  return (
    value === "FREE" ||
    value === "LITE" ||
    value === "PREMIUM" ||
    value === "PREMIUM_TRUCKING"
  );
}

export function normalizePlanId(value: string | null | undefined): PlanId {
  return isPlanId(value) ? value : "FREE";
}

export function getPlan(plan: PlanId | string | null | undefined): PlanDefinition {
  return PLANS[normalizePlanId(plan)];
}

export function planHasFeature(
  plan: PlanId | string | null | undefined,
  feature: PlanFeature
): boolean {
  return getPlan(plan).features.includes(feature);
}

export function isTruckingFeature(feature: PlanFeature): boolean {
  return (TRUCKING_PLAN_FEATURES as readonly string[]).includes(feature);
}

/** Max seats that may be purchased on this plan. null = no cap. */
export function planSeatPurchaseCap(plan: PlanId | string | null | undefined): number | null {
  return getPlan(plan).maxSeats;
}

/**
 * Validate a purchased seat quantity for a paid plan.
 * Returns an error message, or null when valid.
 */
export function validateSeatQuantityForPlan(
  plan: Exclude<PlanId, "FREE">,
  quantity: number
): string | null {
  if (!Number.isInteger(quantity) || quantity < 1) {
    return "Seat quantity must be at least 1";
  }

  const cap = planSeatPurchaseCap(plan);
  if (cap != null && quantity > cap) {
    return `${PLANS[plan].name} allows at most ${cap} seats. Choose Premium for more.`;
  }

  return null;
}

export function formatPlanPrice(plan: PlanId): string {
  const cents = PLANS[plan].priceMonthlyCents;
  if (cents === 0) {
    return "$0";
  }
  return `$${Math.round(cents / 100)}`;
}

/** Nav href → minimum feature required to show the link. */
export const NAV_FEATURE_REQUIREMENTS: Record<string, PlanFeature> = {
  "/dispatch": "dispatch",
  "/search": "search",
  "/locations": "locations",
  "/documents": "documents_upload",
  "/accounting": "accounting_ar_ap",
  "/commissions": "commissions",
  "/commissions/profiles": "commissions",
  "/reports": "reports_summary",
  "/integrations": "marketplace_integrations",
  "/settings/email": "email_mailbox",
  "/admin/accounting": "factoring_admin",
  "/fleet/drivers": "fleet_assets",
  "/fleet/trucks": "fleet_assets",
  "/fleet/trailers": "fleet_assets",
  "/fleet/compliance": "fleet_assets",
  "/fleet/dvir": "fleet_assets",
  "/fleet/safety": "safety_records",
  "/fleet/settlements": "fleet_dispatch",
  "/fleet/fuel-tax": "fuel_tax_ifta"
};

export function upgradePathMessage(feature: PlanFeature, currentPlan: PlanId): string {
  if (isTruckingFeature(feature)) {
    return `This feature requires the Premium + Trucking plan (${formatPlanPrice("PREMIUM_TRUCKING")}/seat/mo). You are on ${PLANS[currentPlan].name}.`;
  }

  const needsPremium =
    PLANS.PREMIUM.features.includes(feature) && !PLANS.LITE.features.includes(feature);
  const target = needsPremium ? "Premium" : "Lite";
  const price = needsPremium ? formatPlanPrice("PREMIUM") : formatPlanPrice("LITE");
  return `This feature requires the ${target} plan (${price}/seat/mo). You are on ${PLANS[currentPlan].name}.`;
}
