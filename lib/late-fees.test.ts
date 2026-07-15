import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countAppliedLateFees,
  formatLateFeePercent,
  lateFeeAmountCents,
  lateFeeBaseCents,
  lateFeeLabel,
  lateFeesToApply,
  overdueLateFeePeriods,
  parseLateFeePercent
} from "../lib/late-fees";

describe("late fee period math", () => {
  it("returns 0 periods when not past due", () => {
    const dueAt = new Date("2026-06-01T12:00:00Z");
    const asOf = new Date("2026-06-01T12:00:00Z");
    assert.equal(overdueLateFeePeriods(dueAt, "Net 30", asOf), 0);
  });

  it("charges one period after a full terms cycle", () => {
    const dueAt = new Date("2026-05-01T12:00:00Z");
    const asOf = new Date("2026-05-31T12:00:00Z");
    assert.equal(overdueLateFeePeriods(dueAt, "Net 30", asOf), 1);
  });

  it("charges two periods after two terms cycles", () => {
    const dueAt = new Date("2026-05-01T12:00:00Z");
    const asOf = new Date("2026-06-30T12:00:00Z");
    assert.equal(overdueLateFeePeriods(dueAt, "Net 30", asOf), 2);
  });

  it("treats due-on-receipt as 1-day periods", () => {
    const dueAt = new Date("2026-05-01T12:00:00Z");
    const asOf = new Date("2026-05-03T12:00:00Z");
    assert.equal(overdueLateFeePeriods(dueAt, "Due on Receipt", asOf), 2);
  });
});

describe("lateFeesToApply stacking", () => {
  const baseCharges = [{ chargeType: "Linehaul", amountCents: 100_000 }];

  it("applies no fees when percent is 0", () => {
    const result = lateFeesToApply({
      dueAt: new Date("2026-05-01"),
      paymentTerms: "Net 30",
      lateFeePercent: 0,
      balanceCents: 100_000,
      status: "SENT",
      charges: baseCharges,
      asOf: new Date("2026-06-30")
    });
    assert.equal(result.feesToApply, 0);
    assert.equal(result.totalAddCents, 0);
  });

  it("applies no fees when balance is paid", () => {
    const result = lateFeesToApply({
      dueAt: new Date("2026-05-01"),
      paymentTerms: "Net 30",
      lateFeePercent: 5,
      balanceCents: 0,
      status: "PAID",
      charges: baseCharges,
      asOf: new Date("2026-06-30")
    });
    assert.equal(result.feesToApply, 0);
  });

  it("applies one fee for one overdue period", () => {
    const result = lateFeesToApply({
      dueAt: new Date("2026-05-01"),
      paymentTerms: "Net 30",
      lateFeePercent: 5,
      balanceCents: 100_000,
      status: "OVERDUE",
      charges: baseCharges,
      asOf: new Date("2026-05-31")
    });
    assert.equal(result.periodsDue, 1);
    assert.equal(result.feesToApply, 1);
    assert.equal(result.feeAmountCents, 5_000);
    assert.equal(result.totalAddCents, 5_000);
  });

  it("applies two fees when two periods due and none applied", () => {
    const result = lateFeesToApply({
      dueAt: new Date("2026-05-01"),
      paymentTerms: "Net 30",
      lateFeePercent: 5,
      balanceCents: 100_000,
      status: "OVERDUE",
      charges: baseCharges,
      asOf: new Date("2026-06-30")
    });
    assert.equal(result.periodsDue, 2);
    assert.equal(result.feesToApply, 2);
    assert.equal(result.totalAddCents, 10_000);
  });

  it("only applies the missing fee when one already exists", () => {
    const result = lateFeesToApply({
      dueAt: new Date("2026-05-01"),
      paymentTerms: "Net 30",
      lateFeePercent: 5,
      balanceCents: 105_000,
      status: "OVERDUE",
      charges: [
        ...baseCharges,
        { chargeType: "Late Fee", amountCents: 5_000 }
      ],
      asOf: new Date("2026-06-30")
    });
    assert.equal(result.periodsDue, 2);
    assert.equal(result.existingCount, 1);
    assert.equal(result.feesToApply, 1);
    assert.equal(result.feeAmountCents, 5_000);
    assert.equal(result.totalAddCents, 5_000);
  });

  it("keeps fee base on original non-late-fee amount", () => {
    assert.equal(
      lateFeeBaseCents([
        { chargeType: "Linehaul", amountCents: 100_000 },
        { chargeType: "Late Fee", amountCents: 5_000 }
      ]),
      100_000
    );
    assert.equal(lateFeeAmountCents(100_000, 5), 5_000);
    assert.equal(countAppliedLateFees([{ chargeType: "Late Fee", amountCents: 1 }, { chargeType: "Linehaul", amountCents: 1 }]), 1);
  });
});

describe("labels and parsing", () => {
  it("labels sequential late fees", () => {
    assert.equal(lateFeeLabel(1), "Late Fee");
    assert.equal(lateFeeLabel(2), "Late Fee (2)");
  });

  it("parses and formats late fee percent", () => {
    assert.equal(parseLateFeePercent("5"), 5);
    assert.equal(parseLateFeePercent("1.5%"), 1.5);
    assert.equal(parseLateFeePercent(""), 0);
    assert.equal(parseLateFeePercent("-3"), 0);
    assert.equal(formatLateFeePercent(5), "5%");
    assert.equal(formatLateFeePercent(1.5), "1.5%");
    assert.equal(formatLateFeePercent(0), "0%");
  });
});
