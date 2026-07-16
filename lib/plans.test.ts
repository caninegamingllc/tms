import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  planHasFeature,
  planSeatPurchaseCap,
  PLANS,
  TRUCKING_PLAN_FEATURES,
  validateSeatQuantityForPlan,
  type PlanFeature
} from "@/lib/plans";

describe("subscription plans", () => {
  it("prices Free / Lite / Premium / Premium+Trucking at $0 / $20 / $60 / $100 per seat", () => {
    assert.equal(PLANS.FREE.priceMonthlyCents, 0);
    assert.equal(PLANS.LITE.priceMonthlyCents, 2000);
    assert.equal(PLANS.PREMIUM.priceMonthlyCents, 6000);
    assert.equal(PLANS.PREMIUM_TRUCKING.priceMonthlyCents, 10000);
  });

  it("caps purchasable seats at 1 / 5 / unlimited / unlimited", () => {
    assert.equal(PLANS.FREE.maxSeats, 1);
    assert.equal(PLANS.LITE.maxSeats, 5);
    assert.equal(PLANS.PREMIUM.maxSeats, null);
    assert.equal(PLANS.PREMIUM_TRUCKING.maxSeats, null);
    assert.equal(planSeatPurchaseCap("FREE"), 1);
    assert.equal(planSeatPurchaseCap("LITE"), 5);
    assert.equal(planSeatPurchaseCap("PREMIUM"), null);
    assert.equal(planSeatPurchaseCap("PREMIUM_TRUCKING"), null);
  });

  it("validates Lite, Premium, and Premium+Trucking seat quantities", () => {
    assert.equal(validateSeatQuantityForPlan("LITE", 1), null);
    assert.equal(validateSeatQuantityForPlan("LITE", 5), null);
    assert.match(validateSeatQuantityForPlan("LITE", 6) ?? "", /at most 5/);
    assert.equal(validateSeatQuantityForPlan("PREMIUM", 1), null);
    assert.equal(validateSeatQuantityForPlan("PREMIUM", 50), null);
    assert.equal(validateSeatQuantityForPlan("PREMIUM_TRUCKING", 50), null);
    assert.match(validateSeatQuantityForPlan("PREMIUM", 0) ?? "", /at least 1/);
  });

  it("keeps Free features minimal", () => {
    const freeOnly: PlanFeature[] = [
      "load_notes",
      "documents_upload",
      "accounting_ar_ap",
      "invite_users",
      "dispatch",
      "customer_portal",
      "email_mailbox",
      "commissions"
    ];
    for (const feature of freeOnly) {
      assert.equal(planHasFeature("FREE", feature), false, feature);
    }
    assert.equal(planHasFeature("FREE", "loads_create"), true);
    assert.equal(planHasFeature("FREE", "customers_basic"), true);
  });

  it("moves Lite features off Free as confirmed", () => {
    const liteFeatures: PlanFeature[] = [
      "load_notes",
      "crm_documents_activity",
      "factoring_assignment",
      "documents_upload",
      "generate_invoice_pdf",
      "accounting_aging",
      "factoring_admin"
    ];
    for (const feature of liteFeatures) {
      assert.equal(planHasFeature("FREE", feature), false, `free:${feature}`);
      assert.equal(planHasFeature("LITE", feature), true, `lite:${feature}`);
      assert.equal(planHasFeature("PREMIUM", feature), true, `premium:${feature}`);
    }
  });

  it("reserves Premium-only modules", () => {
    const premiumOnly: PlanFeature[] = [
      "customer_portal",
      "email_mailbox",
      "email_ops",
      "commissions",
      "quickbooks_online",
      "route_map",
      "late_fees",
      "bulk_invoice_email",
      "multi_branch",
      "audit_log",
      "marketplace_integrations"
    ];
    for (const feature of premiumOnly) {
      assert.equal(planHasFeature("LITE", feature), false, `lite:${feature}`);
      assert.equal(planHasFeature("PREMIUM", feature), true, `premium:${feature}`);
      assert.equal(planHasFeature("PREMIUM_TRUCKING", feature), true, `trucking:${feature}`);
    }
  });

  it("reserves trucking modules for Premium + Trucking only", () => {
    for (const feature of TRUCKING_PLAN_FEATURES) {
      assert.equal(planHasFeature("FREE", feature), false, `free:${feature}`);
      assert.equal(planHasFeature("LITE", feature), false, `lite:${feature}`);
      assert.equal(planHasFeature("PREMIUM", feature), false, `premium:${feature}`);
      assert.equal(planHasFeature("PREMIUM_TRUCKING", feature), true, `trucking:${feature}`);
    }
  });
});
