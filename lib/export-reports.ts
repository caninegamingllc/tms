import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDate, formatMoney } from "@/lib/format";

export type ExportLoadRow = {
  loadNumber: string;
  status: string;
  customer: string;
  lane: string;
  pickupDate: string;
  equipmentType: string;
  commodity: string;
  carrier: string;
  revenue: string;
  margin: string;
};

export type ExportRevenueRow = {
  loadNumber: string;
  customer: string;
  pickupDate: string;
  revenue: string;
  cost: string;
  margin: string;
  marginPercent: string;
};

type ExportMeta = {
  companyName: string;
  title: string;
  filterSummary: string;
  generatedAt: string;
};

function centsToDecimal(cents: number) {
  return (cents / 100).toFixed(2);
}

function isoDate(date: string) {
  return new Date(date).toISOString().slice(0, 10);
}

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function reportFilename(prefix: string, extension: string) {
  const stamp = new Date().toISOString().slice(0, 10);
  return `${prefix}-${stamp}.${extension}`;
}

export function buildLoadExportRows(
  loads: Array<{
    loadNumber: string;
    status: string;
    customer: string;
    pickupCity: string;
    pickupState: string;
    deliveryCity: string;
    deliveryState: string;
    pickupDate: string;
    equipmentType: string;
    commodity: string | null;
    carrier: string;
    revenueCents: number;
    marginCents: number;
  }>
): ExportLoadRow[] {
  return loads.map((load) => ({
    loadNumber: load.loadNumber,
    status: load.status,
    customer: load.customer,
    lane: `${load.pickupCity}, ${load.pickupState} to ${load.deliveryCity}, ${load.deliveryState}`,
    pickupDate: isoDate(load.pickupDate),
    equipmentType: load.equipmentType,
    commodity: load.commodity ?? "General freight",
    carrier: load.carrier,
    revenue: centsToDecimal(load.revenueCents),
    margin: centsToDecimal(load.marginCents)
  }));
}

export function exportLoadsCsv(rows: ExportLoadRow[], filenamePrefix = "loads-report") {
  const headers = [
    "Load #",
    "Status",
    "Customer",
    "Lane",
    "Pickup Date",
    "Equipment",
    "Commodity",
    "Carrier",
    "Revenue",
    "Margin"
  ];

  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      [
        row.loadNumber,
        row.status,
        row.customer,
        row.lane,
        row.pickupDate,
        row.equipmentType,
        row.commodity,
        row.carrier,
        row.revenue,
        row.margin
      ]
        .map(csvEscape)
        .join(",")
    )
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  downloadBlob(reportFilename(filenamePrefix, "csv"), blob);
}

export function exportRevenueCsv(
  summary: {
    loads: ExportRevenueRow[];
    lanes: Array<{ lane: string; count: number; revenueCents: number }>;
    customers: Array<{ customer: string; count: number; revenueCents: number }>;
    totalRevenueCents: number;
    marginCents: number;
    loadCount: number;
  },
  filenamePrefix = "revenue-report"
) {
  const sections: string[] = [
    "Load Profitability",
    "Load #,Customer,Pickup Date,Revenue,Cost,Margin,Margin %",
    ...summary.loads.map((row) =>
      [
        row.loadNumber,
        row.customer,
        row.pickupDate,
        row.revenue,
        row.cost,
        row.margin,
        row.marginPercent
      ]
        .map(csvEscape)
        .join(",")
    ),
    "",
    "Lane Summary",
    "Lane,Loads,Revenue",
    ...summary.lanes.map((lane) =>
      [lane.lane, String(lane.count), centsToDecimal(lane.revenueCents)].map(csvEscape).join(",")
    ),
    "",
    "Customer Volume",
    "Customer,Loads,Revenue",
    ...summary.customers.map((customer) =>
      [customer.customer, String(customer.count), centsToDecimal(customer.revenueCents)]
        .map(csvEscape)
        .join(",")
    ),
    "",
    "Totals",
    `Total Revenue,${centsToDecimal(summary.totalRevenueCents)}`,
    `Gross Margin,${centsToDecimal(summary.marginCents)}`,
    `Load Count,${summary.loadCount}`
  ];

  const blob = new Blob([sections.join("\n")], { type: "text/csv;charset=utf-8;" });
  downloadBlob(reportFilename(filenamePrefix, "csv"), blob);
}

function addPdfHeader(doc: jsPDF, meta: ExportMeta) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(meta.companyName, 40, 40);

  doc.setFontSize(12);
  doc.text(meta.title, 40, 58);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Generated ${meta.generatedAt}`, 40, 72);
  doc.text(meta.filterSummary, 40, 84, { maxWidth: 520 });
}

function addPdfFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Page ${page} of ${pageCount}`, 520, 760, { align: "right" });
  }
}

export function exportLoadsPdf(rows: ExportLoadRow[], meta: ExportMeta, filenamePrefix = "loads-report") {
  const doc = new jsPDF({ unit: "pt", format: "letter", orientation: "landscape" });
  addPdfHeader(doc, meta);

  autoTable(doc, {
    startY: 100,
    head: [
      [
        "Load #",
        "Status",
        "Customer",
        "Lane",
        "Pickup",
        "Equipment",
        "Commodity",
        "Carrier",
        "Revenue",
        "Margin"
      ]
    ],
    body: rows.map((row) => [
      row.loadNumber,
      row.status,
      row.customer,
      row.lane,
      row.pickupDate,
      row.equipmentType,
      row.commodity,
      row.carrier,
      row.revenue,
      row.margin
    ]),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [30, 64, 175], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      8: { halign: "right" },
      9: { halign: "right" }
    },
    margin: { left: 40, right: 40 }
  });

  addPdfFooter(doc);
  doc.save(reportFilename(filenamePrefix, "pdf"));
}

export function exportRevenuePdf(
  summary: {
    loads: ExportRevenueRow[];
    lanes: Array<{ lane: string; count: number; revenueCents: number }>;
    customers: Array<{ customer: string; count: number; revenueCents: number }>;
    totalRevenueCents: number;
    marginCents: number;
    loadCount: number;
    avgRevenueCents: number;
  },
  meta: ExportMeta,
  filenamePrefix = "revenue-report"
) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  addPdfHeader(doc, meta);

  let startY = 110;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Summary", 40, startY);
  startY += 14;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const summaryLines = [
    `Total Revenue: ${formatMoney(summary.totalRevenueCents)}`,
    `Gross Margin: ${formatMoney(summary.marginCents)}`,
    `Loads: ${summary.loadCount}`,
    `Average Revenue / Load: ${formatMoney(summary.avgRevenueCents)}`
  ];
  summaryLines.forEach((line, index) => {
    doc.text(line, 40, startY + index * 12);
  });

  startY += summaryLines.length * 12 + 10;

  autoTable(doc, {
    startY,
    head: [["Load #", "Customer", "Pickup", "Revenue", "Cost", "Margin", "Margin %"]],
    body: summary.loads.map((row) => [
      row.loadNumber,
      row.customer,
      row.pickupDate,
      row.revenue,
      row.cost,
      row.margin,
      row.marginPercent
    ]),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [30, 64, 175], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" }
    },
    margin: { left: 40, right: 40 }
  });

  const laneStart = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? startY;
  autoTable(doc, {
    startY: laneStart + 18,
    head: [["Lane", "Loads", "Revenue"]],
    body: summary.lanes.map((lane) => [
      lane.lane,
      String(lane.count),
      centsToDecimal(lane.revenueCents)
    ]),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [30, 64, 175], textColor: 255 },
    columnStyles: { 2: { halign: "right" } },
    margin: { left: 40, right: 40 }
  });

  const customerStart = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? laneStart;
  autoTable(doc, {
    startY: customerStart + 18,
    head: [["Customer", "Loads", "Revenue"]],
    body: summary.customers.map((customer) => [
      customer.customer,
      String(customer.count),
      centsToDecimal(customer.revenueCents)
    ]),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [30, 64, 175], textColor: 255 },
    columnStyles: { 2: { halign: "right" } },
    margin: { left: 40, right: 40 }
  });

  addPdfFooter(doc);
  doc.save(reportFilename(filenamePrefix, "pdf"));
}

export function buildRevenueExportRows(
  loads: Array<{
    loadNumber: string;
    customer: string;
    pickupDate: string;
    revenueCents: number;
    costCents: number;
    marginCents: number;
    marginPercent: string;
  }>
): ExportRevenueRow[] {
  return loads.map((load) => ({
    loadNumber: load.loadNumber,
    customer: load.customer,
    pickupDate: isoDate(load.pickupDate),
    revenue: centsToDecimal(load.revenueCents),
    cost: centsToDecimal(load.costCents),
    margin: centsToDecimal(load.marginCents),
    marginPercent: load.marginPercent
  }));
}

export function buildExportMeta(companyName: string, title: string, filterSummary: string): ExportMeta {
  return {
    companyName,
    title,
    filterSummary,
    generatedAt: formatDate(new Date())
  };
}
