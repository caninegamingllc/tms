import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canClearCarrierDnu,
  isCarrierDnu,
  isCoverageDocumentComplete,
  validateCarrierDocumentInsurance
} from "@/lib/carrier-compliance";

describe("isCarrierDnu", () => {
  it("returns true when dnuAt is set", () => {
    assert.equal(isCarrierDnu({ dnuAt: new Date() }), true);
  });

  it("returns false when dnuAt is null", () => {
    assert.equal(isCarrierDnu({ dnuAt: null }), false);
  });
});

describe("canClearCarrierDnu", () => {
  const carrier = { dnuAt: new Date(), dnuMarkedByUserId: "user-1" };

  it("allows the user who marked DNU", () => {
    assert.equal(canClearCarrierDnu({ id: "user-1", role: "BROKER" }, carrier), true);
  });

  it("allows admins", () => {
    assert.equal(canClearCarrierDnu({ id: "user-2", role: "ADMIN" }, carrier), true);
  });

  it("denies other users", () => {
    assert.equal(canClearCarrierDnu({ id: "user-2", role: "BROKER" }, carrier), false);
  });
});

describe("validateCarrierDocumentInsurance", () => {
  it("passes when BIPD and cargo coverages are complete", () => {
    const result = validateCarrierDocumentInsurance([
      {
        coverageType: "AUTO_LIABILITY",
        insurerName: "Acme Insurance",
        policyNumber: "AL-100",
        expiresAt: new Date("2027-01-01")
      },
      {
        coverageType: "CARGO",
        insurerName: "Acme Insurance",
        policyNumber: "CG-100",
        expiresAt: new Date("2027-01-01")
      }
    ]);

    assert.equal(result.ok, true);
  });

  it("fails when BIPD is missing required fields", () => {
    const result = validateCarrierDocumentInsurance([
      {
        coverageType: "AUTO_LIABILITY",
        insurerName: "Acme Insurance",
        policyNumber: null,
        expiresAt: new Date("2027-01-01")
      },
      {
        coverageType: "CARGO",
        insurerName: "Acme Insurance",
        policyNumber: "CG-100",
        expiresAt: new Date("2027-01-01")
      }
    ]);

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.missing[0], /Auto Liability/);
    }
  });
});

describe("isCoverageDocumentComplete", () => {
  it("requires underwriter, policy number, and expiration", () => {
    assert.equal(
      isCoverageDocumentComplete({
        coverageType: "CARGO",
        insurerName: "Acme",
        policyNumber: "CG-1",
        expiresAt: new Date()
      }),
      true
    );
    assert.equal(
      isCoverageDocumentComplete({
        coverageType: "CARGO",
        insurerName: "Acme",
        policyNumber: "",
        expiresAt: new Date()
      }),
      false
    );
  });
});
