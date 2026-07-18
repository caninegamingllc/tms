import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  authorityDigits,
  carrierLookupNumberCandidates,
  localLookupCandidates,
  mergeLookupResults,
  type CarrierLookupResult
} from "@/lib/carrier-lookup";

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

describe("carrierLookupNumberCandidates", () => {
  it("tries the number without leading zeros before the original digits", () => {
    assert.deepEqual(carrierLookupNumberCandidates("MC-001234"), ["1234", "001234"]);
  });

  it("does not duplicate a number that has no leading zeros", () => {
    assert.deepEqual(carrierLookupNumberCandidates("MC-1234"), ["1234"]);
  });
});

describe("authorityDigits", () => {
  it("strips DOT/MC prefixes and leading zeros", () => {
    assert.equal(authorityDigits("DOT-2418890"), "2418890");
    assert.equal(authorityDigits("MC-001234"), "1234");
    assert.equal(authorityDigits("2418890"), "2418890");
  });
});

describe("localLookupCandidates", () => {
  it("prefers stripped MC candidates while keeping zero-padded fallbacks", () => {
    assert.deepEqual(localLookupCandidates("mc", "MC-001234"), ["1234", "MC1234", "001234", "MC001234"]);
  });

  it("includes DOT-prefixed candidates for digit DOT searches", () => {
    assert.deepEqual(localLookupCandidates("dot", "2418890"), ["2418890", "DOT2418890"]);
  });
});

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

  it("promotes when local DOT is prefixed and FMCSA DOT is digits-only", () => {
    const local = localResult({
      name: "Blue Ridge Transport",
      carrierId: "blue-ridge",
      mcNumber: "MC-784512",
      dotNumber: "DOT-2418890"
    });
    const fmcsa = fmcsaResult({
      name: "BLUE RIDGE TRANSPORT",
      mcNumber: "MC-784512",
      dotNumber: "2418890"
    });

    const results = mergeLookupResults([local], [fmcsa]);

    assert.equal(results.length, 1);
    assert.equal(results[0].source, "local");
    assert.equal(results[0].carrierId, "blue-ridge");
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
