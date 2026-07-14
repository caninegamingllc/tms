import { parsePaymentTermsDays } from "@/lib/accounting-aging";

export type CarrierBillLineItem = {
  id: string;
  description: string;
  type: string;
  rateCents: number;
  quantity: number;
  amountCents: number;
};

export type CarrierBillFormValues = {
  billId?: string;
  loadId: string;
  carrierId: string;
  carrierName: string;
  loadNumber: string;
  billNo: string;
  billReference: string;
  remitAddress: string;
  nameOnCheck: string;
  payeeName: string;
  receivedAt: string;
  dueAt: string;
  paymentTermsDays: number;
  paymentMethod: string;
  notes: string;
  status: string;
  totalCents: number;
  lineItems: CarrierBillLineItem[];
};

function formatRemitBlock(parts: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
}) {
  const cityState = [parts.city, parts.state].filter(Boolean).join(", ");
  const line2 = [cityState, parts.postalCode].filter(Boolean).join(" ");
  return [parts.address?.trim(), line2].filter((line) => line && String(line).trim()).join("\n");
}

function dateInputValue(value?: string | Date | null) {
  if (!value) {
    return "";
  }
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 10);
}

function addDays(isoDate: string, days: number) {
  if (!isoDate) {
    return "";
  }
  const date = new Date(`${isoDate}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function buildDefaultCarrierBillForm(input: {
  bill?: {
    id: string;
    billNo: string;
    billReference?: string | null;
    remitAddress?: string | null;
    nameOnCheck?: string | null;
    payeeName?: string | null;
    receivedAt?: Date | string | null;
    dueAt?: Date | string | null;
    paymentTermsDays?: number | null;
    paymentMethod?: string | null;
    notes?: string | null;
    status: string;
    totalCents: number;
  } | null;
  loadId: string;
  loadNumber: string;
  carrierId: string;
  carrierName: string;
  paymentTerms?: string | null;
  paymentMethod?: string | null;
  payee: {
    displayName: string;
    nameOnCheck: string;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
  };
  lineItems: CarrierBillLineItem[];
  suggestedBillNo: string;
}): CarrierBillFormValues {
  const termsDays =
    input.bill?.paymentTermsDays ?? parsePaymentTermsDays(input.paymentTerms ?? "Net 30");
  const receivedAt = dateInputValue(input.bill?.receivedAt) || dateInputValue(new Date());
  const totalCents =
    input.bill?.totalCents ?? input.lineItems.reduce((sum, line) => sum + line.amountCents, 0);

  return {
    billId: input.bill?.id,
    loadId: input.loadId,
    carrierId: input.carrierId,
    carrierName: input.carrierName,
    loadNumber: input.loadNumber,
    billNo: input.bill?.billNo ?? input.suggestedBillNo,
    billReference: input.bill?.billReference ?? "",
    remitAddress: input.bill?.remitAddress ?? formatRemitBlock(input.payee),
    nameOnCheck: input.bill?.nameOnCheck ?? input.payee.nameOnCheck,
    payeeName: input.bill?.payeeName ?? input.payee.displayName,
    receivedAt,
    dueAt: dateInputValue(input.bill?.dueAt) || addDays(receivedAt, termsDays),
    paymentTermsDays: termsDays,
    paymentMethod: input.bill?.paymentMethod ?? input.paymentMethod ?? "CHECK",
    notes: input.bill?.notes ?? "",
    status: input.bill?.status ?? "APPROVED",
    totalCents,
    lineItems: input.lineItems
  };
}
