import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildIftaWorksheet } from "@/lib/ifta-worksheet";

describe("IFTA worksheet", () => {
  it("allocates taxable gallons by fleet MPG and nets against purchased fuel", () => {
    const worksheet = buildIftaWorksheet({
      trips: [
        { jurisdiction: "TX", miles: 500 },
        { jurisdiction: "OK", miles: 100 }
      ],
      fuels: [{ jurisdiction: "TX", gallons: 80 }]
    });

    assert.equal(worksheet.totalMiles, 600);
    assert.equal(worksheet.totalGallons, 80);
    assert.equal(worksheet.fleetMpg, 7.5);

    const tx = worksheet.rows.find((r) => r.jurisdiction === "TX");
    const ok = worksheet.rows.find((r) => r.jurisdiction === "OK");
    assert.ok(tx);
    assert.ok(ok);
    assert.equal(tx.taxableGallons, 66.67);
    assert.equal(tx.taxPaidGallons, 80);
    assert.equal(tx.netTaxableGallons, -13.33);
    assert.equal(ok.taxableGallons, 13.33);
    assert.equal(ok.taxPaidGallons, 0);
  });
});
