import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatMoney } from "@/lib/format";
import { readStoredFile } from "@/lib/document-storage";
import type { StructuredDocument } from "@/lib/document-templates";
import { generateBillOfLadingPdf } from "@/lib/pdf-bol";

type JsPdfWithAutoTable = jsPDF & {
  lastAutoTable?: { finalY: number };
};

function sanitizeFileBase(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80) || "document";
}

async function loadLogoData(doc: StructuredDocument) {
  if (!doc.company.logoFilePath || !doc.company.logoMimeType) {
    return null;
  }

  try {
    const buffer = await readStoredFile(doc.company.logoFilePath);
    const base64 = buffer.toString("base64");
    const format = doc.company.logoMimeType.includes("png")
      ? "PNG"
      : doc.company.logoMimeType.includes("webp")
        ? "WEBP"
        : "JPEG";
    return { dataUrl: `data:${doc.company.logoMimeType};base64,${base64}`, format, buffer };
  } catch {
    return null;
  }
}

function drawHeader(pdf: jsPDF, doc: StructuredDocument, logo: Awaited<ReturnType<typeof loadLogoData>>) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  let textX = 14;

  if (logo) {
    try {
      pdf.addImage(logo.dataUrl, logo.format as "PNG" | "JPEG" | "WEBP", 14, 12, 28, 18);
      textX = 46;
    } catch {
      pdf.setDrawColor(148, 163, 184);
      pdf.rect(14, 12, 28, 18);
      pdf.setFontSize(8);
      pdf.setTextColor(148, 163, 184);
      pdf.text("LOGO", 22, 23);
      textX = 46;
    }
  } else {
    pdf.setDrawColor(148, 163, 184);
    pdf.rect(14, 12, 28, 18);
    pdf.setFontSize(8);
    pdf.setTextColor(148, 163, 184);
    pdf.text("LOGO", 22, 23);
    textX = 46;
  }

  pdf.setTextColor(15, 23, 42);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text(doc.company.name, textX, 18);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(71, 85, 105);
  let y = 24;
  for (const line of doc.company.addressLines) {
    pdf.text(line, textX, y);
    y += 4;
  }
  const contact = [doc.company.phone, doc.company.email, doc.company.website]
    .filter(Boolean)
    .join("  |  ");
  if (contact) {
    pdf.text(contact, textX, y);
  }

  pdf.setTextColor(15, 23, 42);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text(doc.title, pageWidth - 14, 16, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  const meta = [
    `# ${doc.documentNumber}`,
    `Load ${doc.loadNumber}`,
    `${doc.dateLabel}: ${doc.issuedDate}`,
    ...(doc.dueDate ? [`Due: ${doc.dueDate}`] : [])
  ];
  let metaY = 22;
  for (const line of meta) {
    pdf.text(line, pageWidth - 14, metaY, { align: "right" });
    metaY += 4.5;
  }

  pdf.setDrawColor(43, 107, 128);
  pdf.setLineWidth(0.8);
  pdf.line(14, 36, pageWidth - 14, 36);
  return 42;
}

function ensureSpace(pdf: jsPDF, y: number, needed: number) {
  const pageHeight = pdf.internal.pageSize.getHeight();
  if (y + needed > pageHeight - 16) {
    pdf.addPage();
    return 16;
  }
  return y;
}

export async function generateDocumentPdf(doc: StructuredDocument): Promise<Buffer> {
  if (doc.type === "BOL" && doc.bol) {
    return generateBillOfLadingPdf(doc.bol);
  }

  const pdf = new jsPDF({ unit: "mm", format: "letter" }) as JsPdfWithAutoTable;
  const logo = await loadLogoData(doc);
  let y = drawHeader(pdf, doc, logo);
  const pageWidth = pdf.internal.pageSize.getWidth();
  const contentWidth = pageWidth - 28;

  // Party + details side panels
  pdf.setFillColor(248, 250, 252);
  pdf.roundedRect(14, y, contentWidth / 2 - 3, 32, 2, 2, "F");
  pdf.roundedRect(14 + contentWidth / 2 + 3, y, contentWidth / 2 - 3, 32, 2, 2, "F");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(71, 85, 105);
  pdf.text(doc.partyTitle.toUpperCase(), 18, y + 6);
  pdf.text("SHIPMENT DETAILS", 18 + contentWidth / 2 + 3, y + 6);

  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(15, 23, 42);
  pdf.setFontSize(9);
  let partyY = y + 12;
  for (const line of doc.partyLines.slice(0, 5)) {
    pdf.text(line, 18, partyY, { maxWidth: contentWidth / 2 - 10 });
    partyY += 4.2;
  }

  let detailY = y + 12;
  for (const item of doc.details.slice(0, 5)) {
    pdf.setTextColor(100, 116, 139);
    pdf.text(`${item.label}:`, 18 + contentWidth / 2 + 3, detailY);
    pdf.setTextColor(15, 23, 42);
    pdf.text(item.value, 18 + contentWidth / 2 + 28, detailY, {
      maxWidth: contentWidth / 2 - 36
    });
    detailY += 4.2;
  }

  y += 38;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(71, 85, 105);
  pdf.text("STOPS", 14, y);
  y += 2;

  autoTable(pdf, {
    startY: y,
    head: [["#", "Type", "Location / Appointment"]],
    body: doc.stops.map((stop) => [
      String(stop.sequence),
      stop.type,
      `${stop.facilityName}\n${stop.addressLine || "N/A"}\nAppt: ${stop.appointment}${
        stop.instructions ? `\n${stop.instructions}` : ""
      }`
    ]),
    styles: { fontSize: 8, cellPadding: 2.5, textColor: [30, 41, 59] },
    headStyles: { fillColor: [43, 107, 128], textColor: 255, fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 24 } },
    margin: { left: 14, right: 14 }
  });

  y = (pdf.lastAutoTable?.finalY ?? y) + 8;

  for (const section of doc.extraSections ?? []) {
    y = ensureSpace(pdf, y, 20);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(71, 85, 105);
    pdf.text(section.title.toUpperCase(), 14, y);
    y += 5;
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(15, 23, 42);
    pdf.setFontSize(9);
    for (const line of section.lines) {
      y = ensureSpace(pdf, y, 6);
      pdf.text(line, 14, y, { maxWidth: contentWidth });
      y += 4.5;
    }
    y += 3;
  }

  if (doc.charges?.length) {
    y = ensureSpace(pdf, y, 30);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(71, 85, 105);
    pdf.text("CHARGES", 14, y);
    y += 2;

    autoTable(pdf, {
      startY: y,
      head: [["Description", "Amount"]],
      body: [
        ...doc.charges.map((charge) => [charge.label, formatMoney(charge.amountCents)]),
        ...(doc.totalCents != null ? [["Total", formatMoney(doc.totalCents)]] : [])
      ],
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: [43, 107, 128], textColor: 255 },
      columnStyles: { 1: { halign: "right", cellWidth: 35 } },
      margin: { left: 14, right: 14 },
      didParseCell: (data) => {
        if (doc.totalCents != null && data.section === "body" && data.row.index === doc.charges!.length) {
          data.cell.styles.fontStyle = "bold";
        }
      }
    });
    y = (pdf.lastAutoTable?.finalY ?? y) + 8;
  } else if (doc.totalCents != null) {
    y = ensureSpace(pdf, y, 10);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(15, 23, 42);
    pdf.text(`Total: ${formatMoney(doc.totalCents)}`, 14, y);
    y += 8;
  }

  if (doc.remittance?.length) {
    y = ensureSpace(pdf, y, 20);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(71, 85, 105);
    pdf.text("REMIT PAYMENT TO", 14, y);
    y += 5;
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(15, 23, 42);
    for (const line of doc.remittance) {
      pdf.text(line, 14, y);
      y += 4.5;
    }
    y += 3;
  }

  if (doc.terms.length) {
    y = ensureSpace(pdf, y, 16);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(71, 85, 105);
    pdf.text("TERMS", 14, y);
    y += 5;
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(15, 23, 42);
    pdf.setFontSize(8);
    for (const term of doc.terms) {
      y = ensureSpace(pdf, y, 10);
      const wrapped = pdf.splitTextToSize(`- ${term}`, contentWidth);
      pdf.text(wrapped, 14, y);
      y += wrapped.length * 4 + 2;
    }
  }

  if (doc.signatures.length) {
    y = ensureSpace(pdf, y, 20);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(71, 85, 105);
    pdf.text("AUTHORIZED SIGNATURE", 14, y);
    y += 8;
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(15, 23, 42);
    for (const line of doc.signatures) {
      pdf.text(line, 14, y);
      y += 10;
    }
  }

  const arrayBuffer = pdf.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}

export function pdfFilenameForDocument(doc: StructuredDocument) {
  return `${sanitizeFileBase(doc.type.toLowerCase())}-${sanitizeFileBase(doc.loadNumber)}.pdf`;
}

export async function logoDataUrlForCompany(logoFilePath?: string | null, logoMimeType?: string | null) {
  if (!logoFilePath || !logoMimeType) {
    return null;
  }
  try {
    const buffer = await readStoredFile(logoFilePath);
    return `data:${logoMimeType};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}
