import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  includedSeatQuantity,
  planHasFeature,
  PLANS,
  type PlanFeature
} from "@/lib/plans";

describe("subscription plans", () => {
  it("prices Free / Lite / Premium at $0 / $20 / $60", () => {
    assert.equal(PLANS.FREE.priceMonthlyCents, 0);
    assert.equal(PLANS.LITE.priceMonthlyCents, 2000);
    assert.equal(PLANS.PREMIUM.priceMonthlyCents, 6000);
  });

  it("caps seats at 1 / 5 / unlimited", () => {
    assert.equal(PLANS.FREE.maxSeats, 1);
    assert.equal(PLANS.LITE.maxSeats, 5);
    assert.equal(PLANS.PREMIUM.maxSeats, null);
    assert.equal(includedSeatQuantity("FREE"), 1);
    assert.equal(includedSeatQuantity("LITE"), 5);
    assert.ok(includedSeatQuantity("PREMIUM") >= 100);
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
    }
  });
});
