import { parseQuickbooksConfig, type QuickbooksAccountConfig } from "@/lib/quickbooks/types";

type IifCustomer = {
  name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  phone?: string | null;
  email?: string | null;
};

type IifVendor = {
  name: string;
  printAs?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  phone?: string | null;
  email?: string | null;
};

type IifInvoice = {
  docNumber: string;
  date: Date;
  customerName: string;
  amountCents: number;
  memo?: string;
};

type IifBill = {
  docNumber: string;
  date: Date;
  vendorName: string;
  amountCents: number;
  memo?: string;
};

function tabRow(cells: Array<string | number>) {
  return cells.map((cell) => String(cell)).join("\t");
}

function formatIifDate(date: Date) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

function centsToAmount(cents: number) {
  return (cents / 100).toFixed(2);
}

function addressLines(party: { address?: string | null; city?: string | null; state?: string | null; postalCode?: string | null }) {
  const cityState = [party.city, party.state].filter(Boolean).join(", ");
  const line3 = [cityState, party.postalCode].filter(Boolean).join(" ");
  return {
    baddr1: party.address ?? "",
    baddr2: line3,
    baddr3: ""
  };
}

export function buildIifFile(input: {
  customers: IifCustomer[];
  vendors: IifVendor[];
  invoices: IifInvoice[];
  bills: IifBill[];
  configJson?: string | null;
}) {
  const config: QuickbooksAccountConfig = parseQuickbooksConfig(input.configJson);
  const lines: string[] = [];

  if (input.customers.length > 0) {
    lines.push(tabRow(["!CUST", "NAME", "BADDR1", "BADDR2", "BADDR3", "PHONE1", "EMAIL", "CONT1"]));
    for (const customer of input.customers) {
      const addr = addressLines(customer);
      lines.push(
        tabRow([
          "CUST",
          customer.name,
          addr.baddr1,
          addr.baddr2,
          addr.baddr3,
          customer.phone ?? "",
          customer.email ?? "",
          ""
        ])
      );
    }
  }

  if (input.vendors.length > 0) {
    lines.push(
      tabRow(["!VEND", "NAME", "PRINTAS", "BADDR1", "BADDR2", "BADDR3", "PHONE1", "EMAIL", "CONT1"])
    );
    for (const vendor of input.vendors) {
      const addr = addressLines(vendor);
      lines.push(
        tabRow([
          "VEND",
          vendor.name,
          vendor.printAs ?? vendor.name,
          addr.baddr1,
          addr.baddr2,
          addr.baddr3,
          vendor.phone ?? "",
          vendor.email ?? "",
          ""
        ])
      );
    }
  }

  if (input.invoices.length > 0 || input.bills.length > 0) {
    lines.push(
      tabRow(["!TRNS", "TRNSTYPE", "DATE", "ACCNT", "NAME", "AMOUNT", "DOCNUM", "MEMO"]),
      tabRow(["!SPL", "TRNSTYPE", "DATE", "ACCNT", "NAME", "AMOUNT", "DOCNUM", "MEMO"]),
      tabRow(["!ENDTRNS"])
    );

    for (const invoice of input.invoices) {
      const amount = centsToAmount(invoice.amountCents);
      const date = formatIifDate(invoice.date);
      lines.push(
        tabRow([
          "TRNS",
          "INVOICE",
          date,
          config.accountsReceivable,
          invoice.customerName,
          amount,
          invoice.docNumber,
          invoice.memo ?? ""
        ]),
        tabRow([
          "SPL",
          "INVOICE",
          date,
          config.freightIncome,
          invoice.customerName,
          `-${amount}`,
          invoice.docNumber,
          invoice.memo ?? ""
        ]),
        tabRow(["ENDTRNS"])
      );
    }

    for (const bill of input.bills) {
      const amount = centsToAmount(bill.amountCents);
      const date = formatIifDate(bill.date);
      // BILL: AP credit (negative on TRNS), expense debit on SPL
      lines.push(
        tabRow([
          "TRNS",
          "BILL",
          date,
          config.accountsPayable,
          bill.vendorName,
          `-${amount}`,
          bill.docNumber,
          bill.memo ?? ""
        ]),
        tabRow([
          "SPL",
          "BILL",
          date,
          config.purchasedTransportation,
          bill.vendorName,
          amount,
          bill.docNumber,
          bill.memo ?? ""
        ]),
        tabRow(["ENDTRNS"])
      );
    }
  }

  return `${lines.join("\r\n")}\r\n`;
}
