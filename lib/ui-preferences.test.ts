import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mergeOnboarding,
  parseUiPreferences,
  resolvePageLayouts,
  setPageLayouts,
  type PageLayouts
} from "@/lib/ui-preferences";

const personal: PageLayouts = {
  lg: [{ i: "a", x: 0, y: 0, w: 4, h: 4 }]
};

const orgDefault: PageLayouts = {
  lg: [{ i: "b", x: 0, y: 0, w: 6, h: 3 }]
};

describe("resolvePageLayouts", () => {
  it("prefers a personal layout over the org default", () => {
    assert.equal(resolvePageLayouts(personal, orgDefault), personal);
  });

  it("falls back to the org default when personal is missing", () => {
    assert.equal(resolvePageLayouts(undefined, orgDefault), orgDefault);
  });

  it("returns undefined when neither personal nor org default exists", () => {
    assert.equal(resolvePageLayouts(undefined, undefined), undefined);
  });
});

describe("onboarding preferences", () => {
  it("parses onboarding alongside layouts", () => {
    const parsed = parseUiPreferences({
      layouts: { dashboard: personal },
      onboarding: {
        tourCompletedAt: "2026-01-01T00:00:00.000Z",
        dismissedCoachmarks: ["dashboard-tiles", 12, ""]
      }
    });

    assert.equal(parsed.onboarding?.tourCompletedAt, "2026-01-01T00:00:00.000Z");
    assert.deepEqual(parsed.onboarding?.dismissedCoachmarks, ["dashboard-tiles"]);
    assert.ok(parsed.layouts?.dashboard);
  });

  it("preserves onboarding when saving layouts", () => {
    const next = setPageLayouts(
      {
        layouts: {},
        onboarding: { tourCompletedAt: "2026-01-01T00:00:00.000Z" }
      },
      "dashboard",
      personal
    );

    assert.equal(next.onboarding?.tourCompletedAt, "2026-01-01T00:00:00.000Z");
    assert.deepEqual(next.layouts?.dashboard, personal);
  });

  it("merges dismissals and replay resets", () => {
    const withDismiss = mergeOnboarding(
      { onboarding: { tourCompletedAt: "2026-01-01T00:00:00.000Z" } },
      { dismissCoachmark: "loads-toolbar" }
    );
    assert.deepEqual(withDismiss.onboarding?.dismissedCoachmarks, ["loads-toolbar"]);

    const replayed = mergeOnboarding(withDismiss, {
      tourCompletedAt: null,
      resetCoachmarks: true
    });
    assert.equal(replayed.onboarding?.tourCompletedAt, null);
    assert.deepEqual(replayed.onboarding?.dismissedCoachmarks, []);
  });

  it("returns empty layouts without onboarding for invalid input", () => {
    assert.deepEqual(parseUiPreferences(null), { layouts: {} });
    assert.deepEqual(parseUiPreferences("nope"), { layouts: {} });
  });
});
