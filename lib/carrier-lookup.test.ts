import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeLookupResults, type CarrierLookupResult } from "@/lib/carrier-lookup";

function localResult(overrides: Partial<CarrierLookupResult> & Pick<CarrierLookupResult, "name">): CarrierLookupResult {
  return {
    id: `local-${overrides.carrierId ?? overrides.name}`,
    source: "local",
    carrierId: overrides.carrierId ?? "carrier-1",
    description: `${overrides.name} · Existing carrier in TMS`,
    ...overrides
  };
}

function fmcsaResult(overrides: Partial<CarrierLookupResult> & Pick<CarrierLookupResult, "name">): CarrierLookupResult {
  return {
    id: `fmcsa-${overrides.dotNumber ?? overrides.mcNumber ?? overrides.name}`,
    source: "fmcsa",
    description: overrides.name,
    ...overrides
  };
}

describe("mergeLookupResults", () => {
  it("promotes an FMCSA hit to the existing TMS carrier when DOT matches", () => {
    const local = localResult({
      name: "HOMELAND TRANSPORT INC",
      carrierId: "homeland",
      dotNumber: "2355164"
    });
    const fmcsa = fmcsaResult({
      name: "HOMELAND TRANSPORT INC",
      mcNumber: "MC-806611",
      dotNumber: "2355164",
      insuranceHint: "2 federal filings · BIPD $1,000,000"
    });

    const results = mergeLookupResults([local], [fmcsa]);

    assert.equal(results.length, 1);
    assert.equal(results[0].source, "local");
    assert.equal(results[0].carrierId, "homeland");
    assert.equal(results[0].mcNumber, "MC-806611");
    assert.equal(results[0].insuranceHint, "2 federal filings · BIPD $1,000,000");
    assert.match(results[0].description, /Existing carrier in TMS/);
  });

  it("promotes an FMCSA hit to the existing TMS carrier when MC matches", () => {
    const local = localResult({
      name: "HOMELAND TRANSPORT INC",
      carrierId: "homeland",
      mcNumber: "MC-806611",
      dotNumber: "2355164"
    });
    const fmcsa = fmcsaResult({
      name: "HOMELAND TRANSPORT INC",
      mcNumber: "MC-806611",
      dotNumber: "2355164"
    });

    const results = mergeLookupResults([local], [fmcsa]);

    assert.equal(results.length, 1);
    assert.equal(results[0].source, "local");
    assert.equal(results[0].carrierId, "homeland");
  });

  it("keeps separate carriers when one MC equals another DOT", () => {
    const byMc = fmcsaResult({
      name: "Carrier With MC 806611",
      mcNumber: "MC-806611",
      dotNumber: "2355164"
    });
    const byDot = fmcsaResult({
      name: "Different Carrier With DOT 806611",
      mcNumber: "MC-999001",
      dotNumber: "806611"
    });

    const results = mergeLookupResults([], [byMc, byDot]);

    assert.equal(results.length, 2);
    assert.equal(results[0].name, "Carrier With MC 806611");
    assert.equal(results[1].name, "Different Carrier With DOT 806611");
  });

  it("keeps a local DOT match and a distinct FMCSA MC match for the same digits", () => {
    const localDotHit = localResult({
      name: "Local DOT 806611",
      carrierId: "local-dot",
      dotNumber: "806611"
    });
    const fmcsaMcHit = fmcsaResult({
      name: "FMCSA MC 806611",
      mcNumber: "MC-806611",
      dotNumber: "2355164"
    });

    const results = mergeLookupResults([localDotHit], [fmcsaMcHit]);

    assert.equal(results.length, 2);
    assert.equal(results[0].source, "local");
    assert.equal(results[0].carrierId, "local-dot");
    assert.equal(results[1].source, "fmcsa");
    assert.equal(results[1].mcNumber, "MC-806611");
  });

  it("dedupes identical FMCSA MC and DOT responses for the same entity", () => {
    const fromMc = fmcsaResult({
      name: "HOMELAND TRANSPORT INC",
      mcNumber: "MC-806611",
      dotNumber: "2355164"
    });
    const fromDot = fmcsaResult({
      name: "HOMELAND TRANSPORT INC",
      mcNumber: "MC-806611",
      dotNumber: "2355164",
      insuranceHint: "2 federal filings · BIPD $1,000,000"
    });

    const results = mergeLookupResults([], [fromMc, fromDot]);

    assert.equal(results.length, 1);
    assert.equal(results[0].dotNumber, "2355164");
  });
});
