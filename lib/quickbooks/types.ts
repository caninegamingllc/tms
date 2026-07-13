export type QuickbooksMethod = "NONE" | "ONLINE" | "IIF";

export type AccountingExportMethod = "ONLINE" | "IIF";

export type AccountingExportEntityType = "INVOICE" | "CARRIER_BILL";

export const OAUTH_STATE_COOKIE = "qbo_oauth_state";

export type QuickbooksAccountConfig = {
  accountsReceivable: string;
  accountsPayable: string;
  freightIncome: string;
  purchasedTransportation: string;
  incomeItem?: string;
  expenseItem?: string;
};

export const defaultQuickbooksConfig: QuickbooksAccountConfig = {
  accountsReceivable: "Accounts Receivable",
  accountsPayable: "Accounts Payable",
  freightIncome: "Freight Income",
  purchasedTransportation: "Purchased Transportation",
  incomeItem: "Freight",
  expenseItem: "Purchased Transportation"
};

export type ExportStatusView = {
  method: AccountingExportMethod;
  methodLabel: string;
  exported: boolean;
  exportedAt: string | null;
  status: string | null;
  message: string | null;
  label: string;
};

export function parseQuickbooksConfig(raw: string | null | undefined): QuickbooksAccountConfig {
  if (!raw) {
    return { ...defaultQuickbooksConfig };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<QuickbooksAccountConfig>;
    return {
      accountsReceivable: parsed.accountsReceivable || defaultQuickbooksConfig.accountsReceivable,
      accountsPayable: parsed.accountsPayable || defaultQuickbooksConfig.accountsPayable,
      freightIncome: parsed.freightIncome || defaultQuickbooksConfig.freightIncome,
      purchasedTransportation:
        parsed.purchasedTransportation || defaultQuickbooksConfig.purchasedTransportation,
      incomeItem: parsed.incomeItem || defaultQuickbooksConfig.incomeItem,
      expenseItem: parsed.expenseItem || defaultQuickbooksConfig.expenseItem
    };
  } catch {
    return { ...defaultQuickbooksConfig };
  }
}

export function methodLabel(method: AccountingExportMethod) {
  return method === "ONLINE" ? "QuickBooks Online" : "IIF";
}

export function notExportedLabel(method: AccountingExportMethod) {
  return method === "ONLINE"
    ? "Not exported to QuickBooks Online"
    : "Not exported via IIF";
}

export function exportedLabel(method: AccountingExportMethod, dateLabel: string) {
  return method === "ONLINE"
    ? `Exported to QuickBooks Online on ${dateLabel}`
    : `Exported via IIF on ${dateLabel}`;
}
