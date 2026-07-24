import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { invoiceNumberForLoad } from "./invoice-numbers";

describe("invoiceNumberForLoad", () => {
  it("uses INV- plus the load number", () => {
    assert.equal(invoiceNumberForLoad("2491"), "INV-2491");
    assert.equal(invoiceNumberForLoad("1484"), "INV-1484");
  });

  it("trims whitespace", () => {
    assert.equal(invoiceNumberForLoad("  2491  "), "INV-2491");
  });

  it("rejects empty load numbers", () => {
    assert.throws(() => invoiceNumberForLoad("   "), /Load number is required/);
  });
});
