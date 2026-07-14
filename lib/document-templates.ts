import type { Company, Prisma } from "@prisma/client";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import type { BolFormData } from "@/lib/bol-types";

export type LoadForDocument = Prisma.LoadGetPayload<{
  include: {
    customer: { include: { contacts: true } };
    stops: true;
    charges: true;
    carrierPayLines: { include: { lineType: true } };
    dispatchAssignment: { include: { carrier: { include: { contacts: true } } } };
    invoices: true;
  };
}>;

export type CompanyBranding = Pick<
  Company,
  | "name"
  | "address"
  | "city"
  | "state"
  | "postalCode"
  | "phone"
  | "email"
  | "website"
  | "logoFilePath"
  | "logoMimeType"
>;

export type DocumentStop = {
  sequence: number;
  type: string;
  facilityName: string;
  addressLine: string;
  appointment: string;
  instructions: string;
};

export type DocumentCharge = {
  label: string;
  amountCents: number;
};

export type StructuredDocument = {
  type: "RATE_CONFIRMATION" | "CUSTOMER_LOAD_CONFIRMATION" | "BOL" | "INVOICE";
  title: string;
  documentNumber: string;
  loadNumber: string;
  dateLabel: string;
  issuedDate: string;
  dueDate?: string;
  company: {
    name: string;
    addressLines: string[];
    phone?: string;
    email?: string;
    website?: string;
    logoFilePath?: string | null;
    logoMimeType?: string | null;
  };
  partyTitle: string;
  partyLines: string[];
  details: Array<{ label: string; value: string }>;
  stops: DocumentStop[];
  charges?: DocumentCharge[];
  totalCents?: number;
  extraSections?: Array<{ title: string; lines: string[] }>;
  terms: string[];
  signatures: string[];
  remittance?: string[];
  /** VICS-style Bill of Lading fields (when type === "BOL"). */
  bol?: BolFormData;
};

function companyAddressLines(company: CompanyBranding) {
  const lines: string[] = [];
  if (company.address) {
    lines.push(company.address);
  }
  const cityState = [company.city, company.state].filter(Boolean).join(", ");
  const cityLine = [cityState, company.postalCode].filter(Boolean).join(" ");
  if (cityLine) {
    lines.push(cityLine);
  }
  return lines;
}

export function brandingFromCompany(company: CompanyBranding): StructuredDocument["company"] {
  return {
    name: company.name,
    addressLines: companyAddressLines(company),
    phone: company.phone ?? undefined,
    email: company.email ?? undefined,
    website: company.website ?? undefined,
    logoFilePath: company.logoFilePath,
    logoMimeType: company.logoMimeType
  };
}

function mapStops(load: LoadForDocument): DocumentStop[] {
  return [...load.stops]
    .sort((a, b) => a.sequence - b.sequence)
    .map((stop) => ({
      sequence: stop.sequence,
      type: stop.type,
      facilityName: stop.facilityName || "N/A",
      addressLine: [
        stop.address,
        [stop.city, stop.state].filter(Boolean).join(", "),
        stop.postalCode
      ]
        .filter(Boolean)
        .join(", "),
      appointment: formatDateTime(stop.appointmentAt),
      instructions: stop.instructions || ""
    }));
}

function mapCarrierPayLines(load: LoadForDocument): DocumentCharge[] {
  if (load.carrierPayLines?.length) {
    return load.carrierPayLines.map((line) => {
      const typeName = line.lineType?.name ?? "Pay line";
      const method = line.lineType?.calculationMethod ?? "FLAT";
      let label = typeName;
      if (line.description) {
        label = `${typeName} — ${line.description}`;
      } else if (method === "PER_MILE") {
        label = `${typeName} (${formatMoney(line.unitRateCents)}/mi × ${line.quantity})`;
      } else if (method === "HOURLY") {
        label = `${typeName} (${formatMoney(line.unitRateCents)}/hr × ${line.quantity})`;
      }
      return { label, amountCents: line.amountCents };
    });
  }

  const total = load.dispatchAssignment?.rateCents ?? load.carrierCostCents;
  if (total > 0) {
    return [{ label: "Carrier Rate", amountCents: total }];
  }
  return [];
}

function mapCharges(load: LoadForDocument): DocumentCharge[] {
  if (load.charges.length) {
    return load.charges.map((charge) => ({
      label: charge.label,
      amountCents: charge.amountCents
    }));
  }
  return [{ label: "Linehaul", amountCents: load.revenueCents }];
}

function line(label: string, value?: string | number | null) {
  return `${label}: ${value || "N/A"}`;
}

function moneyLine(label: string, cents?: number | null) {
  return `${label}: ${formatMoney(cents ?? 0)}`;
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

export function buildRateConfirmationDocument(
  load: LoadForDocument,
  documentNumber: string,
  company: CompanyBranding
): StructuredDocument {
  const assignment = load.dispatchAssignment;
  const carrier = assignment?.carrier;
  const carrierContact = carrier?.contacts.find((contact) => contact.isPrimary);
  const payLines = mapCarrierPayLines(load);
  const totalCents = assignment?.rateCents ?? load.carrierCostCents;

  return {
    type: "RATE_CONFIRMATION",
    title: "Carrier Rate Confirmation",
    documentNumber,
    loadNumber: load.loadNumber,
    dateLabel: "Date",
    issuedDate: formatDate(new Date()),
    company: brandingFromCompany(company),
    partyTitle: "Carrier",
    partyLines: [
      carrier?.name || "N/A",
      carrier?.mcNumber ? `MC # ${carrier.mcNumber}` : "",
      carrier?.dotNumber ? `DOT # ${carrier.dotNumber}` : "",
      carrierContact?.name ? `Contact: ${carrierContact.name}` : "",
      carrierContact?.phone || carrier?.phone
        ? `Phone: ${carrierContact?.phone ?? carrier?.phone}`
        : "",
      carrierContact?.email || carrier?.email
        ? `Email: ${carrierContact?.email ?? carrier?.email}`
        : ""
    ].filter(Boolean),
    details: [
      { label: "Customer", value: load.customer.name },
      { label: "Reference", value: load.referenceNumber || "N/A" },
      { label: "Equipment", value: load.equipmentType || "N/A" },
      { label: "Commodity", value: load.commodity || "N/A" },
      {
        label: "Weight",
        value: load.weight ? `${load.weight.toLocaleString()} lbs` : "N/A"
      }
    ],
    stops: mapStops(load),
    charges: payLines,
    totalCents,
    extraSections: [
      {
        title: "Driver / Equipment",
        lines: [
          line("Driver", assignment?.driverName),
          line("Driver Phone", assignment?.driverPhone),
          line("Truck #", assignment?.truckNumber),
          line("Trailer #", assignment?.trailerNumber)
        ]
      }
    ],
    terms: [
      "Carrier must notify broker immediately of delays, OS&D, temperature issues, detention, or accessorials.",
      "Carrier must submit signed POD and all supporting receipts before payment.",
      "Double brokering is prohibited. Carrier agrees it is the motor carrier responsible for this shipment."
    ],
    signatures: ["Carrier Signature: ______________________________ Date: _______________"]
  };
}

function cityStateZip(city?: string | null, state?: string | null, postalCode?: string | null) {
  const cityState = [city, state].filter(Boolean).join(", ");
  return [cityState, postalCode].filter(Boolean).join(" ");
}

function stopToParty(
  stop:
    | {
        facilityName: string;
        address?: string | null;
        city: string;
        state: string;
        postalCode?: string | null;
      }
    | undefined,
  fallbackName: string
) {
  if (!stop) {
    return { name: fallbackName, address: "", cityStateZip: "" };
  }
  return {
    name: stop.facilityName || fallbackName,
    address: stop.address || "",
    cityStateZip: cityStateZip(stop.city, stop.state, stop.postalCode)
  };
}

export function buildBolFormData(
  load: LoadForDocument,
  documentNumber: string,
  company: CompanyBranding
): BolFormData {
  const stops = [...load.stops].sort((a, b) => a.sequence - b.sequence);
  const pickup =
    stops.find((stop) => stop.type.toUpperCase().includes("PICK")) ?? stops[0];
  const delivery =
    [...stops].reverse().find((stop) => stop.type.toUpperCase().includes("DELIV")) ??
    stops[stops.length - 1];

  const assignment = load.dispatchAssignment;
  const carrier = assignment?.carrier;
  const weightLabel = load.weight ? load.weight.toLocaleString() : "";
  const specialInstructions = stops
    .map((stop) => stop.instructions?.trim())
    .filter(Boolean)
    .join(" | ");

  return {
    date: formatDate(new Date()),
    bolNumber: documentNumber,
    pageLabel: "Page 1 of 1",
    shipFrom: stopToParty(pickup, load.customer.name),
    shipTo: stopToParty(delivery, `${load.deliveryCity}, ${load.deliveryState}`),
    carrierName: carrier?.name || "",
    trailerNumber: assignment?.trailerNumber || "",
    sealNumbers: "",
    scac: "",
    proNumber: "",
    billTo: {
      name: company.name,
      address: company.address || "",
      cityStateZip: cityStateZip(company.city, company.state, company.postalCode)
    },
    freightChargeTerms: "THIRD_PARTY",
    specialInstructions,
    masterBol: false,
    customerOrders: [
      {
        orderNumber: load.referenceNumber || load.loadNumber,
        pkgs: "",
        weight: weightLabel,
        palletSlip: "",
        additionalInfo: load.equipmentType || ""
      }
    ],
    handlingUnitQty: "",
    handlingUnitType: "PLT",
    packageQty: "",
    packageType: "",
    weight: weightLabel,
    hazardous: false,
    commodity: load.commodity || "",
    nmfc: "",
    freightClass: "",
    declaredValue: "",
    declaredValuePer: "",
    codAmount: ""
  };
}

function bolFormToPlainText(bol: BolFormData) {
  return [
    "BILL OF LADING",
    line("Date", bol.date),
    line("Bill of Lading Number", bol.bolNumber),
    bol.pageLabel,
    "",
    "SHIP FROM",
    line("Name", bol.shipFrom.name),
    line("Address", bol.shipFrom.address),
    line("City/State/Zip", bol.shipFrom.cityStateZip),
    "",
    "SHIP TO",
    line("Name", bol.shipTo.name),
    line("Address", bol.shipTo.address),
    line("City/State/Zip", bol.shipTo.cityStateZip),
    "",
    "CARRIER",
    line("Carrier Name", bol.carrierName),
    line("Trailer number", bol.trailerNumber),
    line("Seal number(s)", bol.sealNumbers),
    line("SCAC", bol.scac),
    line("Pro number", bol.proNumber),
    "",
    "THIRD PARTY FREIGHT CHARGES BILL TO",
    line("Name", bol.billTo.name),
    line("Address", bol.billTo.address),
    line("City/State/Zip", bol.billTo.cityStateZip),
    line("Freight Charge Terms", bol.freightChargeTerms.replace("_", " ")),
    "",
    "SPECIAL INSTRUCTIONS",
    bol.specialInstructions || "N/A",
    "",
    "CUSTOMER ORDER INFORMATION",
    ...bol.customerOrders.map(
      (row) =>
        `${row.orderNumber} | Pkgs: ${row.pkgs || "—"} | Weight: ${row.weight || "—"} | ${row.additionalInfo || ""}`
    ),
    "",
    "CARRIER INFORMATION",
    line("Handling Unit", [bol.handlingUnitQty, bol.handlingUnitType].filter(Boolean).join(" ") || "N/A"),
    line("Package", [bol.packageQty, bol.packageType].filter(Boolean).join(" ") || "N/A"),
    line("Weight", bol.weight),
    line("Commodity", bol.commodity),
    line("NMFC #", bol.nmfc),
    line("Class", bol.freightClass),
    "",
    "NOTE Liability Limitation for loss or damage in this shipment may be applicable. See 49 U.S.C. § 14706(c)(1)(A) and (B).",
    "",
    "SHIPPER SIGNATURE / DATE: ______________________________",
    "CARRIER SIGNATURE / PICKUP DATE: ______________________________"
  ].join("\n");
}

export function buildBillOfLadingDocument(
  load: LoadForDocument,
  documentNumber: string,
  company: CompanyBranding
): StructuredDocument {
  const bol = buildBolFormData(load, documentNumber, company);
  const pickup = bol.shipFrom;
  const delivery = bol.shipTo;

  return {
    type: "BOL",
    title: "Bill of Lading",
    documentNumber,
    loadNumber: load.loadNumber,
    dateLabel: "Date",
    issuedDate: bol.date,
    company: brandingFromCompany(company),
    partyTitle: "Ship From",
    partyLines: [pickup.name, pickup.address, pickup.cityStateZip].filter(Boolean),
    details: [
      { label: "Ship To", value: [delivery.name, delivery.address, delivery.cityStateZip].filter(Boolean).join(", ") },
      { label: "Carrier", value: bol.carrierName || "N/A" },
      { label: "Customer Order", value: bol.customerOrders[0]?.orderNumber || load.loadNumber },
      { label: "Commodity", value: bol.commodity || "N/A" },
      { label: "Weight", value: bol.weight ? `${bol.weight} lbs` : "N/A" },
      { label: "Trailer #", value: bol.trailerNumber || "N/A" },
      { label: "Freight Terms", value: "3rd Party" }
    ],
    stops: mapStops(load),
    terms: [
      "Liability Limitation for loss or damage in this shipment may be applicable. See 49 U.S.C. § 14706(c)(1)(A) and (B).",
      "Driver must verify piece count, condition, seal number, and temperature if applicable.",
      "Signed POD must be returned to broker after delivery."
    ],
    signatures: [
      "Shipper Signature / Date: ______________________________",
      "Carrier Signature / Pickup Date: ______________________________"
    ],
    bol
  };
}

export function buildCustomerInvoiceDocument(
  load: LoadForDocument,
  documentNumber: string,
  company: CompanyBranding
): StructuredDocument {
  const invoice = load.invoices[0];
  const charges = mapCharges(load);
  const totalCents = invoice?.totalCents ?? load.revenueCents;

  return {
    type: "INVOICE",
    title: "Customer Invoice",
    documentNumber,
    loadNumber: load.loadNumber,
    dateLabel: "Issued",
    issuedDate: formatDate(invoice?.issuedAt ?? new Date()),
    dueDate: formatDate(invoice?.dueAt),
    company: brandingFromCompany(company),
    partyTitle: "Bill To",
    partyLines: [
      load.customer.name,
      load.customer.email ? `Email: ${load.customer.email}` : "",
      load.customer.phone ? `Phone: ${load.customer.phone}` : "",
      load.customer.paymentTerms ? `Terms: ${load.customer.paymentTerms}` : ""
    ].filter(Boolean),
    details: [
      { label: "Reference", value: load.referenceNumber || "N/A" },
      {
        label: "Lane",
        value: `${load.pickupCity}, ${load.pickupState} to ${load.deliveryCity}, ${load.deliveryState}`
      },
      { label: "Pickup", value: formatDate(load.pickupDate) },
      { label: "Delivery", value: formatDate(load.deliveryDate) }
    ],
    stops: mapStops(load),
    charges,
    totalCents,
    terms: ["Payment is due per the terms stated above. Please reference the invoice number on remittance."],
    signatures: [],
    remittance: [
      company.name,
      ...companyAddressLines(company),
      company.email ? `Email: ${company.email}` : "Accounting Department",
      company.phone ? `Phone: ${company.phone}` : ""
    ].filter(Boolean)
  };
}

export function buildCustomerLoadConfirmationDocument(
  load: LoadForDocument,
  documentNumber: string,
  company: CompanyBranding
): StructuredDocument {
  const customerContact = load.customer.contacts.find((contact) => contact.isPrimary);
  const charges = mapCharges(load);

  return {
    type: "CUSTOMER_LOAD_CONFIRMATION",
    title: "Customer Load Confirmation",
    documentNumber,
    loadNumber: load.loadNumber,
    dateLabel: "Date",
    issuedDate: formatDate(new Date()),
    company: brandingFromCompany(company),
    partyTitle: "Customer",
    partyLines: [
      load.customer.name,
      customerContact?.name ? `Contact: ${customerContact.name}` : "",
      customerContact?.phone || load.customer.phone
        ? `Phone: ${customerContact?.phone ?? load.customer.phone}`
        : "",
      customerContact?.email || load.customer.email
        ? `Email: ${customerContact?.email ?? load.customer.email}`
        : "",
      load.referenceNumber ? `Reference: ${load.referenceNumber}` : ""
    ].filter(Boolean),
    details: [
      { label: "Equipment", value: load.equipmentType || "N/A" },
      { label: "Commodity", value: load.commodity || "N/A" },
      {
        label: "Weight",
        value: load.weight ? `${load.weight.toLocaleString()} lbs` : "N/A"
      },
      { label: "Pickup", value: formatDate(load.pickupDate) },
      { label: "Delivery", value: formatDate(load.deliveryDate) },
      {
        label: "Lane",
        value: `${load.pickupCity}, ${load.pickupState} to ${load.deliveryCity}, ${load.deliveryState}`
      }
    ],
    stops: mapStops(load),
    charges,
    totalCents: load.revenueCents,
    terms: [
      "Please review the schedule and contact your broker immediately with any changes.",
      "This confirmation acknowledges the load details and customer rates described above."
    ],
    signatures: []
  };
}

function structuredToPlainText(doc: StructuredDocument) {
  const lines = [
    doc.title.toUpperCase(),
    line(doc.type === "INVOICE" ? "Invoice #" : "Document #", doc.documentNumber),
    line("Load #", doc.loadNumber),
    line(doc.dateLabel, doc.issuedDate),
    ...(doc.dueDate ? [line("Due", doc.dueDate)] : []),
    "",
    "BROKER",
    doc.company.name,
    ...doc.company.addressLines,
    ...(doc.company.phone ? [line("Phone", doc.company.phone)] : []),
    ...(doc.company.email ? [line("Email", doc.company.email)] : []),
    "",
    doc.partyTitle.toUpperCase(),
    ...doc.partyLines,
    "",
    "DETAILS",
    ...doc.details.map((item) => line(item.label, item.value)),
    "",
    "STOPS",
    ...doc.stops.flatMap((stop) => [
      `${stop.sequence}. ${stop.type} — ${stop.facilityName}`,
      line("Address", stop.addressLine),
      line("Appointment", stop.appointment),
      ...(stop.instructions ? [line("Instructions", stop.instructions)] : []),
      ""
    ])
  ];

  for (const section of doc.extraSections ?? []) {
    lines.push(section.title.toUpperCase(), ...section.lines, "");
  }

  if (doc.charges?.length) {
    lines.push(
      doc.type === "RATE_CONFIRMATION" ? "CARRIER PAY" : "CHARGES",
      ...doc.charges.map((charge) => moneyLine(charge.label, charge.amountCents)),
      ""
    );
  }

  if (doc.totalCents != null) {
    lines.push(moneyLine("Total", doc.totalCents), "");
  }

  if (doc.remittance?.length) {
    lines.push("REMIT PAYMENT TO", ...doc.remittance, "");
  }

  if (doc.terms.length) {
    lines.push("TERMS", ...doc.terms, "");
  }

  if (doc.signatures.length) {
    lines.push("AUTHORIZED SIGNATURE", ...doc.signatures);
  }

  return lines.join("\n");
}

/** @deprecated Prefer structured builders; kept as plain-text helper using company branding. */
export function buildRateConfirmation(
  load: LoadForDocument,
  documentNumber: string,
  company: CompanyBranding
) {
  return structuredToPlainText(buildRateConfirmationDocument(load, documentNumber, company));
}

export function buildBillOfLading(
  load: LoadForDocument,
  documentNumber: string,
  company: CompanyBranding
) {
  return bolFormToPlainText(buildBolFormData(load, documentNumber, company));
}

export function buildCustomerInvoice(
  load: LoadForDocument,
  documentNumber: string,
  company: CompanyBranding
) {
  return structuredToPlainText(buildCustomerInvoiceDocument(load, documentNumber, company));
}

export function buildCustomerLoadConfirmation(
  load: LoadForDocument,
  documentNumber: string,
  company: CompanyBranding
) {
  return structuredToPlainText(
    buildCustomerLoadConfirmationDocument(load, documentNumber, company)
  );
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

export function defaultEmailMessage(
  purpose:
    | "CARRIER_RATE_CONFIRMATION"
    | "CUSTOMER_LOAD_CONFIRMATION"
    | "INVOICE"
    | "BOL"
    | "POD_REQUEST",
  loadNumber: string,
  companyName: string
) {
  switch (purpose) {
    case "CARRIER_RATE_CONFIRMATION":
      return `Please find attached the rate confirmation for load ${loadNumber}.\n\nPlease review, sign if required, and confirm receipt.\n\nThank you,\n${companyName}`;
    case "CUSTOMER_LOAD_CONFIRMATION":
      return `Please find attached the load confirmation for ${loadNumber}.\n\nLet us know if you have any questions or changes.\n\nThank you,\n${companyName}`;
    case "INVOICE":
      return `Please find attached the invoice for load ${loadNumber}, along with any supporting documents.\n\nThank you for your business,\n${companyName}`;
    case "BOL":
      return `Please find attached the bill of lading for load ${loadNumber}.\n\nThank you,\n${companyName}`;
    case "POD_REQUEST":
      return `Please send the signed proof of delivery for load ${loadNumber} at your earliest convenience.\n\nThank you,\n${companyName}`;
  }
}

export function plainTextToHtml(text: string) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<div style="font-family:Arial,sans-serif;white-space:pre-wrap;line-height:1.5;color:#0f172a">${escaped}</div>`;
}
