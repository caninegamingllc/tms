import type { PlanId } from "@/lib/plans";

export const PLAN_ORDER: PlanId[] = ["FREE", "LITE", "PREMIUM"];

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
        "Up to 5 seats",
        "Dispatch, docs & invoice PDFs",
        "AR/AP + aging + factoring",
        "FMCSA lookup & QuickBooks IIF"
      ];
    case "PREMIUM":
      return [
        "Unlimited seats & branches",
        "Customer portal & mailbox email",
        "Commissions, QBO Online, maps",
        "Late fees, bulk workflows, audit log"
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

export function planSeatLabel(plan: PlanId): string {
  switch (plan) {
    case "FREE":
      return "1 seat";
    case "LITE":
      return "Up to 5 seats";
    case "PREMIUM":
      return "Unlimited seats";
  }
}
