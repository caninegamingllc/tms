export const ACCOUNTING_READY_LOAD_STATUSES = ["DELIVERED", "INVOICED", "PAID"] as const;

export type AccountingReadyLoadStatus = (typeof ACCOUNTING_READY_LOAD_STATUSES)[number];

export type SettledInvoiceInput = {
  status: string;
  balanceCents: number;
};

export type SettledCarrierBillInput = {
  carrierId: string;
  status: string;
  balanceCents?: number;
};

export type SettledCarrierAssignmentInput = {
  carrierId?: string | null;
};

export type SettledDriverPayLineInput = {
  amountCents: number;
  settlementId?: string | null;
  settlement?: { status: string } | null;
};

export type SettledLoadInput = {
  status: string;
  invoices: SettledInvoiceInput[];
  carrierBills: SettledCarrierBillInput[];
  dispatchAssignments: SettledCarrierAssignmentInput[];
  driverPayLines: SettledDriverPayLineInput[];
};

export function isAccountingReadyStatus(status: string): boolean {
  return (ACCOUNTING_READY_LOAD_STATUSES as readonly string[]).includes(status);
}

function isPaidDocument(doc: { status: string; balanceCents?: number }): boolean {
  if (doc.status === "VOID") return false;
  if (doc.status !== "PAID") return false;
  if (doc.balanceCents != null && doc.balanceCents > 0) return false;
  return true;
}

export function isArDone(invoices: SettledInvoiceInput[]): boolean {
  const open = invoices.filter((invoice) => invoice.status !== "VOID");
  if (open.length === 0) return false;
  return open.every((invoice) => isPaidDocument(invoice));
}

export function isCarrierApDone(input: {
  dispatchAssignments: SettledCarrierAssignmentInput[];
  carrierBills: SettledCarrierBillInput[];
}): boolean {
  const carrierIds = [
    ...new Set(
      input.dispatchAssignments
        .map((row) => row.carrierId)
        .filter((id): id is string => Boolean(id))
    )
  ];
  if (carrierIds.length === 0) return true;

  return carrierIds.every((carrierId) => {
    const bill = input.carrierBills.find(
      (entry) => entry.carrierId === carrierId && entry.status !== "VOID"
    );
    return Boolean(bill && isPaidDocument(bill));
  });
}

export function isDriverApDone(driverPayLines: SettledDriverPayLineInput[]): boolean {
  const lines = driverPayLines.filter((line) => line.amountCents !== 0);
  if (lines.length === 0) return true;

  return lines.every(
    (line) => Boolean(line.settlementId) && line.settlement?.status === "PAID"
  );
}

/** Fully closed for Accounting: AR paid and all carrier/driver AP obligations settled. */
export function isLoadSettled(load: SettledLoadInput): boolean {
  if (!isAccountingReadyStatus(load.status)) return false;
  return (
    isArDone(load.invoices) &&
    isCarrierApDone({
      dispatchAssignments: load.dispatchAssignments,
      carrierBills: load.carrierBills
    }) &&
    isDriverApDone(load.driverPayLines)
  );
}
