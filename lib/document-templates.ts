import type { Company, Prisma } from "@prisma/client";
import { formatAppointmentWindow, formatDate, formatDateTime, formatMoney } from "@/lib/format";
import type { BolFormData } from "@/lib/bol-types";
import {
  hasAssignmentOriginDestination,
  primaryAssignment
} from "@/lib/dispatch-assignment";

export type LoadForDocument = Prisma.LoadGetPayload<{
  include: {
    customer: { include: { contacts: true } };
    stops: true;
    commodityLines: true;
    charges: true;
    carrierPayLines: { include: { lineType: true } };
    dispatchAssignments: {
      include: {
        carrier: { include: { contacts: true } };
        payLines: { include: { lineType: true } };
      };
    };
    invoices: true;
    notes: true;
  };
}>;

type AssignmentForDocument = LoadForDocument["dispatchAssignments"][number];

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

function formatEquipment(load: Pick<LoadForDocument, "equipmentType" | "reeferTempF">) {
  if (!load.equipmentType) {
    return "N/A";
  }

  if (load.equipmentType === "Reefer" && load.reeferTempF != null) {
    return `${load.equipmentType} @ ${load.reeferTempF}°F`;
  }

  return load.equipmentType;
}

function formatCommoditySummary(load: Pick<LoadForDocument, "commodity" | "commodityLines">) {
  const lines = [...(load.commodityLines ?? [])].sort((a, b) => a.sequence - b.sequence);
  if (lines.length === 0) {
    return load.commodity || "N/A";
  }
  if (lines.length === 1) {
    return lines[0].description;
  }
  return `${lines[0].description} (+${lines.length - 1} more)`;
}

function formatLineDims(line: {
  lengthIn: number | null;
  widthIn: number | null;
  heightIn: number | null;
}) {
  const parts = [line.lengthIn, line.widthIn, line.heightIn].filter((value) => value != null);
  if (!parts.length) {
    return "";
  }
  return `${parts.join("x")} in`;
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
      appointment: formatAppointmentWindow(stop.appointmentAt, stop.appointmentEndAt),
      instructions: stop.instructions || ""
    }));
}

function mapAssignmentStops(
  load: LoadForDocument,
  assignment: AssignmentForDocument | null | undefined
): DocumentStop[] {
  if (assignment && hasAssignmentOriginDestination(assignment)) {
    return [
      {
        sequence: 1,
        type: "PICKUP",
        facilityName: assignment.originFacilityName || "Origin",
        addressLine: [
          [assignment.originCity, assignment.originState].filter(Boolean).join(", "),
          assignment.originPostalCode
        ]
          .filter(Boolean)
          .join(" "),
        appointment: "",
        instructions: ""
      },
      {
        sequence: 2,
        type: "DELIVERY",
        facilityName: assignment.destinationFacilityName || "Destination",
        addressLine: [
          [assignment.destinationCity, assignment.destinationState]
            .filter(Boolean)
            .join(", "),
          assignment.destinationPostalCode
        ]
          .filter(Boolean)
          .join(" "),
        appointment: "",
        instructions: ""
      }
    ];
  }
  return mapStops(load);
}

function mapCarrierPayLinesForAssignment(
  load: LoadForDocument,
  assignment: AssignmentForDocument | null | undefined
): DocumentCharge[] {
  const lines =
    assignment?.payLines?.length
      ? assignment.payLines
      : load.carrierPayLines?.filter((line) =>
          assignment ? line.assignmentId === assignment.id : true
        );

  if (lines?.length) {
    return [...lines]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((line) => {
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

  const total = assignment?.rateCents ?? load.carrierCostCents;
  if (total > 0) {
    return [{ label: "Carrier Rate", amountCents: total }];
  }
  return [];
}

function resolveDocumentAssignment(
  load: LoadForDocument,
  assignmentId?: string | null
): AssignmentForDocument | null {
  if (assignmentId) {
    return load.dispatchAssignments.find((row) => row.id === assignmentId) ?? null;
  }
  return (
    primaryAssignment(load.dispatchAssignments.filter((row) => row.carrierId)) ??
    primaryAssignment(load.dispatchAssignments)
  );
}

function mapCharges(load: LoadForDocument): DocumentCharge[] {
  if (load.charges.length) {
    return [...load.charges]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((charge) => ({
        label: charge.label,
        amountCents: charge.amountCents
      }));
  }
  return [{ label: "Flat Rate", amountCents: load.revenueCents }];
}

/** Public load notes only — never include private notes on generated docs. */
export function isPrivateLoadNote(note: { body: string; isPrivate: boolean }) {
  return note.isPrivate || note.body.trim().toLowerCase().startsWith("[private]");
}

export function publicLoadNoteLines(load: {
  notes?: Array<{ body: string; isPrivate: boolean; createdAt: Date }>;
}) {
  return [...(load.notes ?? [])]
    .filter((note) => !isPrivateLoadNote(note))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((note) => note.body.trim())
    .filter(Boolean);
}

function publicNotesSection(
  load: LoadForDocument
): NonNullable<StructuredDocument["extraSections"]>[number] | null {
  const lines = publicLoadNoteLines(load);
  if (!lines.length) {
    return null;
  }
  return { title: "Notes", lines };
}

function withPublicNotes(
  sections: NonNullable<StructuredDocument["extraSections"]> | undefined,
  load: LoadForDocument
) {
  const notes = publicNotesSection(load);
  if (!notes) {
    return sections;
  }
  return [...(sections ?? []), notes];
}

const BUILT_IN_RATE_CONFIRMATION_TERMS = [
  "Carrier must notify broker immediately of delays, OS&D, temperature issues, detention, or accessorials.",
  "Carrier must submit signed POD and all supporting receipts before payment.",
  "Double brokering is prohibited. Carrier agrees it is the motor carrier responsible for this shipment."
];

function splitTermsLines(text: string | null | undefined) {
  if (!text?.trim()) {
    return [];
  }
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Built-in broker terms plus load override or customer default (newline-split). */
export function resolveRateConfirmationTerms(load: {
  rateConfirmationTerms?: string | null;
  customer?: { rateConfirmationTerms?: string | null } | null;
}) {
  const custom =
    load.rateConfirmationTerms?.trim() ||
    load.customer?.rateConfirmationTerms?.trim() ||
    "";
  return [...BUILT_IN_RATE_CONFIRMATION_TERMS, ...splitTermsLines(custom)];
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
  company: CompanyBranding,
  assignmentId?: string | null
): StructuredDocument {
  const assignment = resolveDocumentAssignment(load, assignmentId);
  const carrier = assignment?.carrier;
  const carrierContact = carrier?.contacts.find((contact) => contact.isPrimary);
  const payLines = mapCarrierPayLinesForAssignment(load, assignment);
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
      { label: "Equipment", value: formatEquipment(load) },
      { label: "Commodity", value: formatCommoditySummary(load) },
      {
        label: "Weight",
        value: load.weight ? `${load.weight.toLocaleString()} lbs` : "N/A"
      }
    ],
    stops: mapAssignmentStops(load, assignment),
    charges: payLines,
    totalCents,
    extraSections: withPublicNotes(
      [
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
      load
    ),
    terms: resolveRateConfirmationTerms(load),
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

  const assignment = primaryAssignment(load.dispatchAssignments);
  const carrier = assignment?.carrier;
  const weightLabel = load.weight ? load.weight.toLocaleString() : "";
  const stopInstructions = stops
    .map((stop) => stop.instructions?.trim())
    .filter(Boolean);
  const publicNotes = publicLoadNoteLines(load);
  const specialInstructions = [...stopInstructions, ...publicNotes].join(" | ");
  const freightLines = [...(load.commodityLines ?? [])].sort((a, b) => a.sequence - b.sequence);
  const customerOrders =
    freightLines.length > 0
      ? freightLines.map((line) => {
          const dims = formatLineDims(line);
          return {
            orderNumber: load.referenceNumber || load.loadNumber,
            pkgs: line.pieces || String(line.quantity),
            weight: line.weightLbs ? line.weightLbs.toLocaleString() : "",
            palletSlip: "" as const,
            additionalInfo: [line.description, dims, formatEquipment(load)].filter(Boolean).join(" · ")
          };
        })
      : [
          {
            orderNumber: load.referenceNumber || load.loadNumber,
            pkgs: "",
            weight: weightLabel,
            palletSlip: "" as const,
            additionalInfo: formatEquipment(load)
          }
        ];

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
    customerOrders,
    handlingUnitQty: freightLines.length
      ? String(freightLines.reduce((sum, line) => sum + (line.quantity || 0), 0))
      : "",
    handlingUnitType: "PLT",
    packageQty: "",
    packageType: "",
    weight: weightLabel,
    hazardous: false,
    commodity: formatCommoditySummary(load) === "N/A" ? "" : formatCommoditySummary(load),
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
    extraSections: withPublicNotes(undefined, load),
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
    extraSections: withPublicNotes(undefined, load),
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
      { label: "Equipment", value: formatEquipment(load) },
      { label: "Commodity", value: formatCommoditySummary(load) },
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
    extraSections: withPublicNotes(undefined, load),
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
  company: CompanyBranding,
  assignmentId?: string | null
) {
  return structuredToPlainText(
    buildRateConfirmationDocument(load, documentNumber, company, assignmentId)
  );
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
  const assignment = primaryAssignment(load.dispatchAssignments);
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

/** Subject line for a customer invoice batch (one or more invoices). */
export function defaultInvoiceBatchSubject(
  invoices: Array<{ invoiceNo: string; loadNumber: string }>,
  companyName: string
) {
  if (invoices.length === 1) {
    const only = invoices[0];
    return `Invoice ${only.invoiceNo} for load ${only.loadNumber}`;
  }
  const numbers = invoices.map((item) => item.invoiceNo).join(", ");
  return `Invoices ${numbers} from ${companyName}`;
}

/** Body for a customer invoice batch email. */
export function defaultInvoiceBatchMessage(
  invoices: Array<{ invoiceNo: string; loadNumber: string }>,
  companyName: string
) {
  if (invoices.length === 1) {
    return defaultEmailMessage("INVOICE", invoices[0].loadNumber, companyName);
  }
  const lines = invoices
    .map((item) => `- Invoice ${item.invoiceNo} (load ${item.loadNumber})`)
    .join("\n");
  return `Please find attached the following invoices, along with any supporting documents:\n\n${lines}\n\nThank you for your business,\n${companyName}`;
}

export function plainTextToHtml(text: string) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<div style="font-family:'Source Sans 3',Arial,sans-serif;white-space:pre-wrap;line-height:1.5;color:#1b2433">${escaped}</div>`;
}
