import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isAccountingReadyStatus,
  isArDone,
  isCarrierApDone,
  isDriverApDone,
  isLoadSettled
} from "@/lib/accounting-settled";

describe("accounting settled helpers", () => {
  it("treats only DELIVERED/INVOICED/PAID as accounting-ready", () => {
    assert.equal(isAccountingReadyStatus("DELIVERED"), true);
    assert.equal(isAccountingReadyStatus("INVOICED"), true);
    assert.equal(isAccountingReadyStatus("PAID"), true);
    assert.equal(isAccountingReadyStatus("DISPATCHED"), false);
    assert.equal(isAccountingReadyStatus("PENDING"), false);
    assert.equal(isAccountingReadyStatus("PICKED_UP"), false);
    assert.equal(isAccountingReadyStatus("CANCELED"), false);
  });

  it("requires at least one paid non-void invoice for AR done", () => {
    assert.equal(isArDone([]), false);
    assert.equal(isArDone([{ status: "DRAFT", balanceCents: 100 }]), false);
    assert.equal(isArDone([{ status: "PAID", balanceCents: 0 }]), true);
    assert.equal(
      isArDone([
        { status: "PAID", balanceCents: 0 },
        { status: "VOID", balanceCents: 0 }
      ]),
      true
    );
    assert.equal(
      isArDone([
        { status: "PAID", balanceCents: 0 },
        { status: "PARTIAL", balanceCents: 50 }
      ]),
      false
    );
  });

  it("requires a paid bill for every assigned carrier", () => {
    assert.equal(isCarrierApDone({ dispatchAssignments: [], carrierBills: [] }), true);
    assert.equal(
      isCarrierApDone({
        dispatchAssignments: [{ carrierId: "c1" }],
        carrierBills: []
      }),
      false
    );
    assert.equal(
      isCarrierApDone({
        dispatchAssignments: [{ carrierId: "c1" }],
        carrierBills: [{ carrierId: "c1", status: "APPROVED", balanceCents: 100 }]
      }),
      false
    );
    assert.equal(
      isCarrierApDone({
        dispatchAssignments: [{ carrierId: "c1" }, { carrierId: "c2" }],
        carrierBills: [
          { carrierId: "c1", status: "PAID", balanceCents: 0 },
          { carrierId: "c2", status: "PAID", balanceCents: 0 }
        ]
      }),
      true
    );
  });

  it("requires PAID settlements for non-zero driver pay lines", () => {
    assert.equal(isDriverApDone([]), true);
    assert.equal(isDriverApDone([{ amountCents: 0 }]), true);
    assert.equal(
      isDriverApDone([{ amountCents: 100, settlementId: "s1", settlement: { status: "DRAFT" } }]),
      false
    );
    assert.equal(
      isDriverApDone([{ amountCents: 100, settlementId: "s1", settlement: { status: "PAID" } }]),
      true
    );
  });

  it("marks a load settled only when AR and all AP sides are closed", () => {
    const base = {
      status: "PAID",
      invoices: [{ status: "PAID", balanceCents: 0 }],
      carrierBills: [] as Array<{ carrierId: string; status: string; balanceCents: number }>,
      dispatchAssignments: [] as Array<{ carrierId?: string | null }>,
      driverPayLines: [] as Array<{
        amountCents: number;
        settlementId?: string | null;
        settlement?: { status: string } | null;
      }>
    };

    assert.equal(isLoadSettled(base), true);
    assert.equal(isLoadSettled({ ...base, status: "DISPATCHED" }), false);
    assert.equal(
      isLoadSettled({
        ...base,
        dispatchAssignments: [{ carrierId: "c1" }],
        carrierBills: [{ carrierId: "c1", status: "PAID", balanceCents: 0 }]
      }),
      true
    );
    assert.equal(
      isLoadSettled({
        ...base,
        dispatchAssignments: [{ carrierId: "c1" }],
        carrierBills: [],
        driverPayLines: [
          { amountCents: 200, settlementId: "s1", settlement: { status: "PAID" } }
        ]
      }),
      false
    );
    assert.equal(
      isLoadSettled({
        ...base,
        dispatchAssignments: [{ carrierId: "c1" }],
        carrierBills: [{ carrierId: "c1", status: "PAID", balanceCents: 0 }],
        driverPayLines: [
          { amountCents: 200, settlementId: "s1", settlement: { status: "PAID" } }
        ]
      }),
      true
    );
  });
});
