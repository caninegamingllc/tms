import { jsPDF } from "jspdf";
import type { BolFormData, BolParty } from "@/lib/bol-types";

export type { BolFormData } from "@/lib/bol-types";

function drawBox(
  pdf: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  options?: { fill?: [number, number, number]; lineWidth?: number }
) {
  pdf.setDrawColor(0);
  pdf.setLineWidth(options?.lineWidth ?? 0.35);
  if (options?.fill) {
    pdf.setFillColor(...options.fill);
    pdf.rect(x, y, w, h, "FD");
  } else {
    pdf.rect(x, y, w, h);
  }
}

function headerBar(pdf: jsPDF, x: number, y: number, w: number, h: number, label: string) {
  drawBox(pdf, x, y, w, h, { fill: [0, 0, 0] });
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text(label, x + 1.5, y + h - 2);
  pdf.setTextColor(0, 0, 0);
}

function fieldLabel(pdf: jsPDF, text: string, x: number, y: number, size = 6.5) {
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(size);
  pdf.setTextColor(0, 0, 0);
  pdf.text(text, x, y);
}

function fieldValue(pdf: jsPDF, text: string, x: number, y: number, maxWidth?: number, size = 8) {
  if (!text) return;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(size);
  pdf.setTextColor(0, 0, 0);
  if (maxWidth) {
    const lines = pdf.splitTextToSize(text, maxWidth);
    pdf.text(lines, x, y);
  } else {
    pdf.text(text, x, y);
  }
}

function checkbox(pdf: jsPDF, x: number, y: number, checked: boolean, size = 3) {
  pdf.setDrawColor(0);
  pdf.setLineWidth(0.3);
  pdf.rect(x, y, size, size);
  if (checked) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.text("X", x + 0.55, y + 2.4);
  }
}

function dashedLine(pdf: jsPDF, x: number, y: number, w: number) {
  pdf.setDrawColor(0);
  pdf.setLineWidth(0.25);
  pdf.setLineDashPattern([1, 1], 0);
  pdf.line(x, y, x + w, y);
  pdf.setLineDashPattern([], 0);
}

function partyBlock(
  pdf: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  party: BolParty,
  mode: "from" | "to"
) {
  headerBar(pdf, x, y, w, 5, title);
  drawBox(pdf, x, y + 5, w, h - 5);

  const innerX = x + 2;
  fieldLabel(pdf, "Name:", innerX, y + 9);
  fieldValue(pdf, party.name, innerX + 12, y + 9, w - 16);

  fieldLabel(pdf, "Address:", innerX, y + 14);
  fieldValue(pdf, party.address, innerX + 14, y + 14, w - 18);

  fieldLabel(pdf, "City/State/Zip:", innerX, y + 19);
  fieldValue(pdf, party.cityStateZip, innerX + 22, y + 19, w - 26);

  if (mode === "from") {
    fieldLabel(pdf, "SID#:", innerX, y + 24.5);
    fieldValue(pdf, party.sid || "", innerX + 10, y + 24.5, 40);
    checkbox(pdf, x + w - 18, y + 22.5, Boolean(party.fob));
    fieldLabel(pdf, "FOB:", x + w - 28, y + 25);
  } else {
    fieldLabel(pdf, "CID#:", innerX, y + 24.5);
    fieldValue(pdf, party.cid || "", innerX + 10, y + 24.5, 28);
    fieldLabel(pdf, "Location #:", x + w / 2, y + 24.5);
    fieldValue(pdf, party.locationNumber || "", x + w / 2 + 18, y + 24.5, 28);
    checkbox(pdf, x + w - 18, y + 22.5, Boolean(party.fob));
    fieldLabel(pdf, "FOB:", x + w - 28, y + 25);
  }
}

/**
 * Draws a VICS / tidyforms-style Bill of Lading matching the blank BOL template.
 */
export function generateBillOfLadingPdf(bol: BolFormData): Buffer {
  const pdf = new jsPDF({ unit: "mm", format: "letter" });
  const pageW = pdf.internal.pageSize.getWidth();
  const margin = 8;
  const contentW = pageW - margin * 2;
  let y = 6;

  // Header
  fieldLabel(pdf, "Date:", margin, y + 3, 8);
  fieldValue(pdf, bol.date, margin + 10, y + 3, 40, 9);
  pdf.setFont("times", "bold");
  pdf.setFontSize(16);
  pdf.text("BILL OF LADING", pageW / 2, y + 4, { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text(bol.pageLabel, pageW - margin, y + 3, { align: "right" });

  y = 10;

  const leftW = contentW * 0.52;
  const rightW = contentW - leftW;
  const rightX = margin + leftW;

  // Top-right: BOL number + barcode
  drawBox(pdf, rightX, y, rightW, 18);
  fieldLabel(pdf, "Bill of Lading Number:", rightX + 2, y + 5);
  fieldValue(pdf, bol.bolNumber, rightX + 2, y + 10, rightW - 4, 11);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(100);
  pdf.text("B A R C O D E   S P A C E", rightX + rightW / 2, y + 15.5, { align: "center" });
  pdf.setTextColor(0);

  // SHIP FROM
  partyBlock(pdf, margin, y, leftW, 28, "SHIP FROM", bol.shipFrom, "from");

  y += 28;

  // SHIP TO + CARRIER block
  const shipToH = 28;
  partyBlock(pdf, margin, y, leftW, shipToH, "SHIP TO", bol.shipTo, "to");

  drawBox(pdf, rightX, y, rightW, shipToH);
  fieldLabel(pdf, "CARRIER NAME:", rightX + 2, y + 5);
  fieldValue(pdf, bol.carrierName, rightX + 28, y + 5, rightW - 32, 9);

  fieldLabel(pdf, "Trailer number:", rightX + 2, y + 11);
  fieldValue(pdf, bol.trailerNumber, rightX + 28, y + 11, rightW - 32);

  fieldLabel(pdf, "Seal number(s):", rightX + 2, y + 16.5);
  fieldValue(pdf, bol.sealNumbers, rightX + 28, y + 16.5, rightW - 32);

  fieldLabel(pdf, "SCAC:", rightX + 2, y + 22);
  fieldValue(pdf, bol.scac, rightX + 14, y + 22, 30);
  fieldLabel(pdf, "Pro number:", rightX + rightW / 2, y + 22);
  fieldValue(pdf, bol.proNumber, rightX + rightW / 2 + 20, y + 22, 40);

  y += shipToH;

  // THIRD PARTY + freight terms
  const billH = 26;
  headerBar(pdf, margin, y, leftW, 5, "THIRD PARTY FREIGHT CHARGES BILL TO:");
  drawBox(pdf, margin, y + 5, leftW, billH - 5);
  fieldLabel(pdf, "Name:", margin + 2, y + 10);
  fieldValue(pdf, bol.billTo.name, margin + 14, y + 10, leftW - 18);
  fieldLabel(pdf, "Address:", margin + 2, y + 15);
  fieldValue(pdf, bol.billTo.address, margin + 16, y + 15, leftW - 20);
  fieldLabel(pdf, "City/State/Zip:", margin + 2, y + 20);
  fieldValue(pdf, bol.billTo.cityStateZip, margin + 24, y + 20, leftW - 28);

  drawBox(pdf, rightX, y, rightW, billH);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(6.5);
  pdf.text("B A R C O D E   S P A C E", rightX + rightW / 2, y + 5, { align: "center" });
  pdf.setDrawColor(180);
  pdf.rect(rightX + 4, y + 7, rightW - 8, 6);
  pdf.setDrawColor(0);

  fieldLabel(pdf, "Freight Charge Terms: (freight charges are prepaid unless", rightX + 2, y + 16, 5.5);
  fieldLabel(pdf, "marked otherwise)", rightX + 2, y + 19, 5.5);

  const termY = y + 22.5;
  checkbox(pdf, rightX + 2, termY - 2.5, bol.freightChargeTerms === "PREPAID");
  fieldLabel(pdf, "Prepaid", rightX + 6.5, termY);
  checkbox(pdf, rightX + 28, termY - 2.5, bol.freightChargeTerms === "COLLECT");
  fieldLabel(pdf, "Collect", rightX + 32.5, termY);
  checkbox(pdf, rightX + 52, termY - 2.5, bol.freightChargeTerms === "THIRD_PARTY");
  fieldLabel(pdf, "3rd Party", rightX + 56.5, termY);

  y += billH;

  // SPECIAL INSTRUCTIONS
  const instrH = 16;
  headerBar(pdf, margin, y, contentW * 0.55, 5, "SPECIAL INSTRUCTIONS:");
  drawBox(pdf, margin, y + 5, contentW * 0.55, instrH - 5);
  if (bol.specialInstructions) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    const lines = pdf.splitTextToSize(bol.specialInstructions, contentW * 0.55 - 4);
    pdf.text(lines.slice(0, 4), margin + 2, y + 9);
  }

  drawBox(pdf, margin + contentW * 0.55, y, contentW * 0.45, instrH);
  checkbox(pdf, margin + contentW * 0.55 + 3, y + 4, bol.masterBol);
  fieldLabel(pdf, "Master Bill of Lading: with attached underlying", margin + contentW * 0.55 + 8, y + 6.5, 6);
  fieldLabel(pdf, "Bills of Lading", margin + contentW * 0.55 + 8, y + 10, 6);

  y += instrH + 1;

  // CUSTOMER ORDER INFORMATION
  const orderRows = 5;
  const orderRowH = 5;
  const orderHeaderH = 10;
  const orderTableH = orderHeaderH + orderRows * orderRowH + 5;
  const col = {
    order: contentW * 0.28,
    pkgs: contentW * 0.1,
    weight: contentW * 0.12,
    pallet: contentW * 0.14,
    info: contentW * 0.36
  };

  headerBar(pdf, margin, y, contentW, 5, "CUSTOMER ORDER INFORMATION");
  y += 5;

  // column headers
  drawBox(pdf, margin, y, contentW, orderHeaderH, { fill: [235, 235, 235] });
  let cx = margin;
  const headers = [
    ["CUSTOMER ORDER NUMBER", col.order],
    ["# PKGS", col.pkgs],
    ["WEIGHT", col.weight],
    ["PALLET/SLIP\n(CIRCLE ONE)", col.pallet],
    ["ADDITIONAL SHIPPER INFO", col.info]
  ] as const;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(6);
  for (const [label, w] of headers) {
    drawBox(pdf, cx, y, w, orderHeaderH);
    const lines = label.split("\n");
    pdf.text(lines, cx + w / 2, y + (lines.length > 1 ? 3.5 : 6), { align: "center" });
    cx += w;
  }
  y += orderHeaderH;

  for (let i = 0; i < orderRows; i++) {
    const row = bol.customerOrders[i];
    cx = margin;
    const vals = [
      row?.orderNumber || "",
      row?.pkgs || "",
      row?.weight || "",
      "",
      row?.additionalInfo || ""
    ];
    const widths = [col.order, col.pkgs, col.weight, col.pallet, col.info];
    for (let j = 0; j < widths.length; j++) {
      drawBox(pdf, cx, y, widths[j], orderRowH);
      if (j === 3) {
        // Y / N circles
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7);
        const yChecked = row?.palletSlip === "Y";
        const nChecked = row?.palletSlip === "N";
        pdf.circle(cx + widths[j] * 0.3, y + 2.5, 1.6);
        pdf.circle(cx + widths[j] * 0.7, y + 2.5, 1.6);
        pdf.text("Y", cx + widths[j] * 0.3, y + 3.2, { align: "center" });
        pdf.text("N", cx + widths[j] * 0.7, y + 3.2, { align: "center" });
        if (yChecked) {
          pdf.setFont("helvetica", "bold");
          pdf.text("●", cx + widths[j] * 0.3, y + 3.4, { align: "center" });
        }
        if (nChecked) {
          pdf.setFont("helvetica", "bold");
          pdf.text("●", cx + widths[j] * 0.7, y + 3.4, { align: "center" });
        }
      } else if (vals[j]) {
        fieldValue(pdf, vals[j], cx + 1.5, y + 3.5, widths[j] - 3, 7);
      }
      cx += widths[j];
    }
    y += orderRowH;
  }

  // Grand total row for orders
  drawBox(pdf, margin, y, col.order, 5, { fill: [230, 230, 230] });
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7);
  pdf.text("GRAND TOTAL", margin + 2, y + 3.5);
  const totalPkgs = bol.customerOrders.reduce((sum, row) => sum + (Number(row.pkgs) || 0), 0);
  const totalWeight = bol.customerOrders.reduce((sum, row) => sum + (Number(String(row.weight).replace(/,/g, "")) || 0), 0);
  drawBox(pdf, margin + col.order, y, col.pkgs, 5);
  fieldValue(pdf, totalPkgs ? String(totalPkgs) : bol.packageQty, margin + col.order + 1.5, y + 3.5, col.pkgs - 3, 7);
  drawBox(pdf, margin + col.order + col.pkgs, y, col.weight, 5);
  fieldValue(
    pdf,
    totalWeight ? totalWeight.toLocaleString() : bol.weight,
    margin + col.order + col.pkgs + 1.5,
    y + 3.5,
    col.weight - 3,
    7
  );
  drawBox(pdf, margin + col.order + col.pkgs + col.weight, y, col.pallet + col.info, 5);
  y += 6;

  // CARRIER INFORMATION
  headerBar(pdf, margin, y, contentW, 5, "CARRIER INFORMATION");
  y += 5;

  const stampW = contentW * 0.14;
  const mainW = contentW - stampW;
  const huW = mainW * 0.14;
  const pkgW = mainW * 0.14;
  const wtW = mainW * 0.1;
  const hmW = mainW * 0.06;
  const descW = mainW * 0.4;
  const ltlW = mainW * 0.16;
  const carrierHeaderH = 10;
  const carrierRows = 4;
  const carrierRowH = 7;

  // Nested headers
  drawBox(pdf, margin, y, mainW, carrierHeaderH, { fill: [235, 235, 235] });
  drawBox(pdf, margin + mainW, y, stampW, carrierHeaderH + carrierRows * carrierRowH + 5, {
    fill: [245, 245, 245]
  });

  // HANDLING UNIT / PACKAGE / etc
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(5.5);
  let hx = margin;
  drawBox(pdf, hx, y, huW, 5);
  pdf.text("HANDLING UNIT", hx + huW / 2, y + 3.5, { align: "center" });
  hx += huW;
  drawBox(pdf, hx, y, pkgW, 5);
  pdf.text("PACKAGE", hx + pkgW / 2, y + 3.5, { align: "center" });
  hx += pkgW;
  drawBox(pdf, hx, y, wtW, carrierHeaderH);
  pdf.text("WEIGHT", hx + wtW / 2, y + 6, { align: "center" });
  hx += wtW;
  drawBox(pdf, hx, y, hmW, carrierHeaderH);
  pdf.text("H.M.\n(X)", hx + hmW / 2, y + 4, { align: "center" });
  hx += hmW;
  drawBox(pdf, hx, y, descW, carrierHeaderH);
  pdf.text("COMMODITY DESCRIPTION", hx + descW / 2, y + 4, { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(4.5);
  pdf.text("See Section 2(e) of NMFC Item 360", hx + descW / 2, y + 8, { align: "center" });
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(5.5);
  hx += descW;
  drawBox(pdf, hx, y, ltlW, 5);
  pdf.text("LTL ONLY", hx + ltlW / 2, y + 3.5, { align: "center" });

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(6);
  const stampLines = pdf.splitTextToSize("RECEIVING STAMP SPACE", stampW - 4);
  pdf.text(stampLines, margin + mainW + stampW / 2, y + 20, { align: "center" });

  // sub headers
  y += 5;
  hx = margin;
  const sub = [
    [huW / 2, "QTY"],
    [huW / 2, "TYPE"],
    [pkgW / 2, "QTY"],
    [pkgW / 2, "TYPE"]
  ] as const;
  for (const [w, label] of sub) {
    drawBox(pdf, hx, y, w, 5);
    pdf.text(label, hx + w / 2, y + 3.5, { align: "center" });
    hx += w;
  }
  // weight and hm already span
  hx = margin + huW + pkgW + wtW + hmW + descW;
  drawBox(pdf, hx, y, ltlW / 2, 5);
  pdf.text("NMFC #", hx + ltlW / 4, y + 3.5, { align: "center" });
  drawBox(pdf, hx + ltlW / 2, y, ltlW / 2, 5);
  pdf.text("CLASS", hx + (ltlW * 3) / 4, y + 3.5, { align: "center" });

  y += 5;

  for (let i = 0; i < carrierRows; i++) {
    const isFirst = i === 0;
    hx = margin;
    const cells: Array<[number, string]> = [
      [huW / 2, isFirst ? bol.handlingUnitQty : ""],
      [huW / 2, isFirst ? bol.handlingUnitType : ""],
      [pkgW / 2, isFirst ? bol.packageQty : ""],
      [pkgW / 2, isFirst ? bol.packageType : ""],
      [wtW, isFirst ? bol.weight : ""],
      [hmW, isFirst && bol.hazardous ? "X" : ""],
      [descW, isFirst ? bol.commodity : ""],
      [ltlW / 2, isFirst ? bol.nmfc : ""],
      [ltlW / 2, isFirst ? bol.freightClass : ""]
    ];
    for (const [w, val] of cells) {
      drawBox(pdf, hx, y, w, carrierRowH);
      if (val) {
        fieldValue(pdf, val, hx + 1, y + 4.5, w - 2, 6.5);
      }
      hx += w;
    }
    y += carrierRowH;
  }

  // Grand total
  drawBox(pdf, margin, y, huW + pkgW, 5, { fill: [230, 230, 230] });
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7);
  pdf.text("GRAND TOTAL", margin + 2, y + 3.5);
  drawBox(pdf, margin + huW + pkgW, y, wtW, 5);
  fieldValue(pdf, bol.weight, margin + huW + pkgW + 1, y + 3.5, wtW - 2, 7);
  drawBox(pdf, margin + huW + pkgW + wtW, y, hmW + descW + ltlW, 5);
  y += 7;

  // Declared value + COD
  drawBox(pdf, margin, y, contentW * 0.68, 18);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(5.5);
  pdf.text(
    "Where the rate is dependent on value, shippers are required to state specifically in writing the agreed or",
    margin + 2,
    y + 4
  );
  pdf.text('declared value of the property as follows:  "The agreed or declared value of the property is specifically', margin + 2, y + 7);
  pdf.text("stated by the shipper to be not exceeding", margin + 2, y + 10);
  dashedLine(pdf, margin + 55, y + 10.5, 35);
  if (bol.declaredValue) {
    fieldValue(pdf, bol.declaredValue, margin + 56, y + 10, 33, 7);
  }
  fieldLabel(pdf, "per", margin + 92, y + 10);
  dashedLine(pdf, margin + 100, y + 10.5, 30);
  if (bol.declaredValuePer) {
    fieldValue(pdf, bol.declaredValuePer, margin + 101, y + 10, 28, 7);
  }
  pdf.text('."', margin + 131, y + 10);

  drawBox(pdf, margin + contentW * 0.68, y, contentW * 0.32, 18);
  fieldLabel(pdf, "COD Amount: $", margin + contentW * 0.68 + 2, y + 5);
  dashedLine(pdf, margin + contentW * 0.68 + 28, y + 5.5, 28);
  if (bol.codAmount) {
    fieldValue(pdf, bol.codAmount, margin + contentW * 0.68 + 29, y + 5, 26, 7);
  }
  fieldLabel(pdf, "Fee Terms:", margin + contentW * 0.68 + 2, y + 10);
  checkbox(pdf, margin + contentW * 0.68 + 2, y + 12, false);
  fieldLabel(pdf, "Collect", margin + contentW * 0.68 + 6.5, y + 14.5);
  checkbox(pdf, margin + contentW * 0.68 + 28, y + 12, false);
  fieldLabel(pdf, "Prepaid", margin + contentW * 0.68 + 32.5, y + 14.5);

  y += 19;

  // NOTE liability
  drawBox(pdf, margin, y, contentW, 8);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(6);
  pdf.text("NOTE", margin + 2, y + 3);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(5.5);
  pdf.text(
    "Liability Limitation for loss or damage in this shipment may be applicable. See 49 U.S.C. § 14706(c)(1)(A) and (B).",
    margin + 12,
    y + 3
  );
  pdf.text(
    "RECEIVED, subject to individually determined rates or contracts that have been agreed upon in writing between the carrier and shipper,",
    margin + 2,
    y + 6.5
  );

  y += 9;

  // Signature section
  const sigH = 32;
  const sigW = contentW / 3;
  drawBox(pdf, margin, y, sigW, sigH);
  drawBox(pdf, margin + sigW, y, sigW, sigH);
  drawBox(pdf, margin + sigW * 2, y, sigW, sigH);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(6.5);
  pdf.text("SHIPPER SIGNATURE / DATE", margin + 2, y + 4);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(5);
  const shipperLegal = pdf.splitTextToSize(
    "This is to certify that the above named materials are properly classified, packaged, marked and labeled, and are in proper condition for transportation according to the applicable regulations of the DOT.",
    sigW - 4
  );
  pdf.text(shipperLegal, margin + 2, y + 8);
  dashedLine(pdf, margin + 2, y + 28, sigW - 4);
  fieldLabel(pdf, "Shipper Signature", margin + 2, y + 30.5, 5);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(6.5);
  pdf.text("Trailer Loaded:", margin + sigW + 2, y + 4);
  checkbox(pdf, margin + sigW + 2, y + 6, false);
  fieldLabel(pdf, "By Shipper", margin + sigW + 6.5, y + 8.5);
  checkbox(pdf, margin + sigW + 2, y + 11, false);
  fieldLabel(pdf, "By Driver", margin + sigW + 6.5, y + 13.5);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(6.5);
  pdf.text("Freight Counted:", margin + sigW + 2, y + 17);
  checkbox(pdf, margin + sigW + 2, y + 18.5, false);
  fieldLabel(pdf, "By Shipper", margin + sigW + 6.5, y + 21);
  checkbox(pdf, margin + sigW + 2, y + 22.5, false);
  fieldLabel(pdf, "By Driver/pallets said to contain", margin + sigW + 6.5, y + 25);
  checkbox(pdf, margin + sigW + 2, y + 26.5, false);
  fieldLabel(pdf, "By Driver/Pieces", margin + sigW + 6.5, y + 29);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(6.5);
  pdf.text("CARRIER SIGNATURE / PICKUP DATE", margin + sigW * 2 + 2, y + 4);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(5);
  const carrierLegal = pdf.splitTextToSize(
    "Carrier acknowledges receipt of packages and required placards. Carrier certifies emergency response information was made available and/or carrier has the DOT emergency response guidebook or equivalent documentation in the vehicle. Property described above is received in good order, except as noted.",
    sigW - 4
  );
  pdf.text(carrierLegal, margin + sigW * 2 + 2, y + 8);
  dashedLine(pdf, margin + sigW * 2 + 2, y + 28, sigW - 4);

  const arrayBuffer = pdf.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}
