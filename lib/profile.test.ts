import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DISPLAY_NAME_MAX_LENGTH,
  normalizeDisplayName,
  validateDisplayName,
  validatePasswordChangeInput
} from "@/lib/profile";

describe("profile display name", () => {
  it("normalizes surrounding and internal whitespace", () => {
    assert.equal(normalizeDisplayName("  Ada   Lovelace  "), "Ada Lovelace");
  });

  it("requires a non-empty name", () => {
    assert.equal(validateDisplayName(""), "Name is required");
    assert.equal(validateDisplayName("   "), "Name is required");
  });

  it("rejects names over the max length", () => {
    const tooLong = "a".repeat(DISPLAY_NAME_MAX_LENGTH + 1);
    assert.match(validateDisplayName(tooLong) ?? "", /100 characters/);
  });

  it("accepts a valid name", () => {
    assert.equal(validateDisplayName("Ada Lovelace"), null);
    assert.equal(validateDisplayName("  Ada  "), null);
  });
});

describe("password change input", () => {
  it("requires matching passwords of at least 8 characters", () => {
    assert.equal(
      validatePasswordChangeInput({ newPassword: "short", confirmPassword: "short" }),
      "Password must match and be at least 8 characters"
    );
    assert.equal(
      validatePasswordChangeInput({
        newPassword: "longenough",
        confirmPassword: "different1"
      }),
      "Password must match and be at least 8 characters"
    );
  });

  it("accepts matching passwords of sufficient length", () => {
    assert.equal(
      validatePasswordChangeInput({
        newPassword: "longenough",
        confirmPassword: "longenough"
      }),
      null
    );
  });
});
