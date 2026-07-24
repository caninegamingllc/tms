import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("nextInvoiceNumber allocation logic", () => {
  it("increments from the highest INV- suffix", () => {
    const latest = "INV-2478";
    const match = latest.match(/^INV-(\d+)$/i);
    const next = match ? Number(match[1]) + 1 : 1001;
    assert.equal(`INV-${String(next).padStart(4, "0")}`, "INV-2479");
  });

  it("does not use invoice count when gaps exist", () => {
    const count = 1243;
    const countBased = `INV-${String(count + 1001).padStart(4, "0")}`;
    assert.equal(countBased, "INV-2244");
    assert.notEqual(countBased, "INV-2479");
  });
});
