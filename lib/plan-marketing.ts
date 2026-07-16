import type { PlanId } from "@/lib/plans";

export const PLAN_ORDER: PlanId[] = ["FREE", "LITE", "PREMIUM", "PREMIUM_TRUCKING"];

/** Short marketing bullets shared by Admin Billing and the public landing. */
export function planHighlights(plan: PlanId): string[] {
  switch (plan) {
    case "FREE":
      return [
        "1 user only",
        "Basic load board (25 loads/month)",
        "Basic customers & carriers",
        "No documents, accounting, or email"
      ];
    case "LITE":
      return [
        "Buy up to 5 seats ($20/seat/mo)",
        "Dispatch, docs & invoice PDFs",
        "AR/AP + aging + factoring",
        "FMCSA lookup & QuickBooks IIF"
      ];
    case "PREMIUM":
      return [
        "Buy as many seats as you need ($60/seat/mo)",
        "Customer portal & mailbox email",
        "Commissions, QBO Online, maps",
        "Late fees, bulk workflows, audit log"
      ];
    case "PREMIUM_TRUCKING":
      return [
        "Everything in Premium ($100/seat/mo)",
        "Drivers, trucks & trailers with compliance",
        "DQF, safety records & fleet dispatch",
        "ELD + IFTA scaffolding for fleets"
      ];
  }
}

/** Premium-only differentiators vs Lite — for landing compare strip. */
export const PREMIUM_ONLY_HIGHLIGHTS = [
  "Customer portal",
  "Mailbox email",
  "Commissions",
  "QuickBooks Online",
  "Route maps",
  "Late fees",
  "Multi-branch",
  "Audit log"
] as const;

/** Trucking tier differentiators vs Premium. */
export const TRUCKING_ONLY_HIGHLIGHTS = [
  "Driver / truck / trailer registry",
  "Fleet assignment on loads",
  "Driver Qualification File (DQF)",
  "Safety & accident records",
  "Compliance expiration dashboard",
  "ELD & IFTA ready (Samsara, Motive, Geotab)"
] as const;

export function planSeatLabel(plan: PlanId): string {
  switch (plan) {
    case "FREE":
      return "1 seat included";
    case "LITE":
      return "Buy up to 5 seats";
    case "PREMIUM":
      return "Buy unlimited seats";
    case "PREMIUM_TRUCKING":
      return "Buy unlimited seats";
  }
}
