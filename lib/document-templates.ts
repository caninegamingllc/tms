import type { Prisma } from "@prisma/client";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";

type LoadForDocument = Prisma.LoadGetPayload<{
  include: {
    customer: { include: { contacts: true } };
    stops: true;
    charges: true;
    dispatchAssignment: { include: { carrier: { include: { contacts: true } } } };
    invoices: true;
  };
}>;

function line(label: string, value?: string | number | null) {
  return `${label}: ${value || "N/A"}`;
}

function moneyLine(label: string, cents?: number | null) {
  return `${label}: ${formatMoney(cents ?? 0)}`;
}

function stopBlock(stop: LoadForDocument["stops"][number]) {
  return [
    `${stop.sequence}. ${stop.type}`,
    line("Facility", stop.facilityName),
    line("Address", stop.address),
    line("City/State", `${stop.city}, ${stop.state}${stop.postalCode ? ` ${stop.postalCode}` : ""}`),
    line("Appointment", formatDateTime(stop.appointmentAt)),
    line("Instructions", stop.instructions)
  ].join("\n");
}

export function documentTitle(type: string, loadNumber: string) {
  if (type === "RATE_CONFIRMATION") {
    return `Carrier Rate Confirmation - ${loadNumber}`;
  }
  if (type === "CUSTOMER_LOAD_CONFIRMATION") {
    return `Customer Load Confirmation - ${loadNumber}`;
  }
  if (type === "BOL") {
    return `Bill of Lading - ${loadNumber}`;
  }
  if (type === "INVOICE") {
    return `Customer Invoice - ${loadNumber}`;
  }

  return `Document - ${loadNumber}`;
}

export function buildRateConfirmation(load: LoadForDocument, documentNumber: string) {
  const assignment = load.dispatchAssignment;
  const carrier = assignment?.carrier;
  const carrierContact = carrier?.contacts.find((contact) => contact.isPrimary);

  return [
    "CARRIER RATE CONFIRMATION",
    line("Confirmation #", documentNumber),
    line("Load #", load.loadNumber),
    line("Date", formatDate(new Date())),
    "",
    "BROKER",
    "Great Lakes Brokerage",
    "",
    "CARRIER",
    line("Name", carrier?.name),
    line("MC #", carrier?.mcNumber),
    line("DOT #", carrier?.dotNumber),
    line("Contact", carrierContact?.name),
    line("Phone", carrierContact?.phone ?? carrier?.phone),
    line("Email", carrierContact?.email ?? carrier?.email),
    "",
    "LOAD DETAILS",
    line("Customer", load.customer.name),
    line("Reference", load.referenceNumber),
    line("Equipment", load.equipmentType),
    line("Commodity", load.commodity),
    line("Weight", load.weight ? `${load.weight.toLocaleString()} lbs` : null),
    moneyLine("Carrier Rate", assignment?.rateCents ?? load.carrierCostCents),
    "",
    "STOPS",
    ...load.stops.sort((a, b) => a.sequence - b.sequence).map(stopBlock),
    "",
    "DRIVER / EQUIPMENT",
    line("Driver", assignment?.driverName),
    line("Driver Phone", assignment?.driverPhone),
    line("Truck #", assignment?.truckNumber),
    line("Trailer #", assignment?.trailerNumber),
    "",
    "TERMS",
    "Carrier must notify broker immediately of delays, OS&D, temperature issues, detention, or accessorials.",
    "Carrier must submit signed POD and all supporting receipts before payment.",
    "Double brokering is prohibited. Carrier agrees it is the motor carrier responsible for this shipment.",
    "",
    "AUTHORIZED SIGNATURE",
    "Carrier Signature: ______________________________ Date: _______________"
  ].join("\n");
}

export function buildBillOfLading(load: LoadForDocument, documentNumber: string) {
  return [
    "BILL OF LADING",
    line("BOL #", documentNumber),
    line("Load #", load.loadNumber),
    line("Customer Reference", load.referenceNumber),
    line("Date", formatDate(new Date())),
    "",
    "SHIPPER / CONSIGNEE",
    line("Customer", load.customer.name),
    line("Customer Phone", load.customer.phone),
    line("Customer Email", load.customer.email),
    "",
    "FREIGHT",
    line("Commodity", load.commodity),
    line("Equipment", load.equipmentType),
    line("Weight", load.weight ? `${load.weight.toLocaleString()} lbs` : null),
    "",
    "STOPS",
    ...load.stops.sort((a, b) => a.sequence - b.sequence).map(stopBlock),
    "",
    "SPECIAL INSTRUCTIONS",
    "Driver must verify piece count, condition, seal number, and temperature if applicable.",
    "Signed POD must be returned to broker after delivery.",
    "",
    "SIGNATURES",
    "Shipper: ______________________________ Date: _______________",
    "Carrier: ______________________________ Date: _______________",
    "Consignee: ____________________________ Date: _______________"
  ].join("\n");
}

export function buildCustomerInvoice(load: LoadForDocument, documentNumber: string) {
  const invoice = load.invoices[0];
  const charges = load.charges.length
    ? load.charges.map((charge) => `${charge.label} - ${formatMoney(charge.amountCents)}`)
    : [`Linehaul - ${formatMoney(load.revenueCents)}`];

  return [
    "CUSTOMER INVOICE",
    line("Invoice #", documentNumber),
    line("Load #", load.loadNumber),
    line("Issued", formatDate(invoice?.issuedAt ?? new Date())),
    line("Due", formatDate(invoice?.dueAt)),
    "",
    "BILL TO",
    line("Customer", load.customer.name),
    line("Email", load.customer.email),
    line("Phone", load.customer.phone),
    line("Terms", load.customer.paymentTerms),
    "",
    "SHIPMENT",
    line("Reference", load.referenceNumber),
    line("Lane", `${load.pickupCity}, ${load.pickupState} to ${load.deliveryCity}, ${load.deliveryState}`),
    line("Pickup", formatDate(load.pickupDate)),
    line("Delivery", formatDate(load.deliveryDate)),
    "",
    "CHARGES",
    ...charges,
    "",
    moneyLine("Invoice Total", invoice?.totalCents ?? load.revenueCents),
    "",
    "REMIT PAYMENT TO",
    "Great Lakes Brokerage",
    "Accounting Department",
    "accounting@example.com"
  ].join("\n");
}

export function buildCustomerLoadConfirmation(load: LoadForDocument, documentNumber: string) {
  const customerContact = load.customer.contacts.find((contact) => contact.isPrimary);
  const charges = load.charges.length
    ? load.charges.map((charge) => `${charge.label} - ${formatMoney(charge.amountCents)}`)
    : [`Linehaul - ${formatMoney(load.revenueCents)}`];

  return [
    "CUSTOMER LOAD CONFIRMATION",
    line("Confirmation #", documentNumber),
    line("Load #", load.loadNumber),
    line("Date", formatDate(new Date())),
    "",
    "CUSTOMER",
    line("Name", load.customer.name),
    line("Contact", customerContact?.name),
    line("Phone", customerContact?.phone ?? load.customer.phone),
    line("Email", customerContact?.email ?? load.customer.email),
    line("Reference", load.referenceNumber),
    "",
    "SHIPMENT",
    line("Equipment", load.equipmentType),
    line("Commodity", load.commodity),
    line("Weight", load.weight ? `${load.weight.toLocaleString()} lbs` : null),
    line("Pickup", formatDate(load.pickupDate)),
    line("Delivery", formatDate(load.deliveryDate)),
    line("Lane", `${load.pickupCity}, ${load.pickupState} to ${load.deliveryCity}, ${load.deliveryState}`),
    "",
    "STOPS",
    ...load.stops.sort((a, b) => a.sequence - b.sequence).map(stopBlock),
    "",
    "CHARGES",
    ...charges,
    moneyLine("Total", load.revenueCents),
    "",
    "NOTES",
    "Please review the schedule and contact your broker immediately with any changes.",
    "This confirmation acknowledges the load details and customer rates described above."
  ].join("\n");
}

export function buildPodRequestEmail(load: LoadForDocument, brokerEmail: string) {
  const assignment = load.dispatchAssignment;
  const carrier = assignment?.carrier;

  return [
    `Proof of delivery request for load ${load.loadNumber}`,
    "",
    `Hello ${carrier?.name ?? "Carrier"},`,
    "",
    `Please send the signed POD for load ${load.loadNumber} at your earliest convenience.`,
    "",
    line("Load #", load.loadNumber),
    line("Reference", load.referenceNumber),
    line("Lane", `${load.pickupCity}, ${load.pickupState} to ${load.deliveryCity}, ${load.deliveryState}`),
    line("Delivery", formatDate(load.deliveryDate)),
    line("Driver", assignment?.driverName),
    line("Truck #", assignment?.truckNumber),
    "",
    "Reply to this email with the signed POD (PDF or photo) attached.",
    `If you have questions, contact ${brokerEmail}.`,
    "",
    "Thank you,"
  ].join("\n");
}

export function plainTextToHtml(text: string) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<div style="font-family:Arial,sans-serif;white-space:pre-wrap;line-height:1.5;color:#0f172a">${escaped}</div>`;
}
