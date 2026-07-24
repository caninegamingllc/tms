import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getLoadBoardStage } from "@/lib/dispatch-board";
import {
  isPendingLoadStatus,
  loadHasDispatchedCoverage,
  statusAfterCoverageAssigned,
  statusAfterCoverageCleared
} from "@/lib/dispatch-assignment";
import { daysWaitingToInvoice, uninvoicedUrgency } from "@/lib/uninvoiced-alert";

describe("getLoadBoardStage with PENDING", () => {
  it("maps PENDING without assignment to pending stage", () => {
    assert.equal(getLoadBoardStage({ status: "PENDING", dispatchAssignments: [] }), "pending");
  });

  it("maps PENDING with assignment to active", () => {
    assert.equal(
      getLoadBoardStage({ status: "PENDING", dispatchAssignments: [{ id: "a" }] }),
      "active"
    );
  });

  it("maps DISPATCHED to active", () => {
    assert.equal(getLoadBoardStage({ status: "DISPATCHED", dispatchAssignments: [] }), "active");
  });

  it("maps DELIVERED to completed", () => {
    assert.equal(getLoadBoardStage({ status: "DELIVERED", dispatchAssignments: [] }), "completed");
  });
});

describe("coverage status transitions", () => {
  it("advances PENDING/AVAILABLE/QUOTE/COVERED to DISPATCHED on assign", () => {
    assert.equal(statusAfterCoverageAssigned("PENDING"), "DISPATCHED");
    assert.equal(statusAfterCoverageAssigned("AVAILABLE"), "DISPATCHED");
    assert.equal(statusAfterCoverageAssigned("QUOTE"), "DISPATCHED");
    assert.equal(statusAfterCoverageAssigned("COVERED"), "DISPATCHED");
    assert.equal(statusAfterCoverageAssigned("PICKED_UP"), "PICKED_UP");
  });

  it("reverts COVERED/DISPATCHED to PENDING when uncovered", () => {
    assert.equal(statusAfterCoverageCleared("DISPATCHED"), "PENDING");
    assert.equal(statusAfterCoverageCleared("COVERED"), "PENDING");
    assert.equal(statusAfterCoverageCleared("PICKED_UP"), "PICKED_UP");
  });

  it("treats PENDING as a pending load status", () => {
    assert.equal(isPendingLoadStatus("PENDING"), true);
    assert.equal(isPendingLoadStatus("AVAILABLE"), true);
    assert.equal(isPendingLoadStatus("DISPATCHED"), false);
  });

  it("requires carrier or driver+truck for dispatched coverage", () => {
    assert.equal(loadHasDispatchedCoverage([]), false);
    assert.equal(loadHasDispatchedCoverage([{ sequence: 0, carrierId: "c1" }]), true);
    assert.equal(
      loadHasDispatchedCoverage([{ sequence: 0, carrierId: null, driverId: "d1", truckId: null }]),
      false
    );
    assert.equal(
      loadHasDispatchedCoverage([{ sequence: 0, carrierId: null, driverId: null, truckId: "t1" }]),
      false
    );
    assert.equal(
      loadHasDispatchedCoverage([{ sequence: 0, carrierId: null, driverId: "d1", truckId: "t1" }]),
      true
    );
  });
});

describe("uninvoiced aging", () => {
  it("counts calendar days waiting", () => {
    const delivered = new Date(2026, 6, 20);
    const now = new Date(2026, 6, 24);
    assert.equal(daysWaitingToInvoice(delivered, now), 4);
  });

  it("maps day bands to urgency colors", () => {
    assert.equal(uninvoicedUrgency(0), "amber");
    assert.equal(uninvoicedUrgency(1), "amber");
    assert.equal(uninvoicedUrgency(2), "orange");
    assert.equal(uninvoicedUrgency(3), "orange");
    assert.equal(uninvoicedUrgency(4), "rose");
  });
});
