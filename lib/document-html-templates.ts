import { formatMoney } from "@/lib/format";
import type { StructuredDocument } from "@/lib/document-templates";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderBolHtml(doc: StructuredDocument, forPrint?: boolean) {
  const bol = doc.bol!;
  const term = bol.freightChargeTerms;
  const orderRows = Array.from({ length: 5 }, (_, i) => bol.customerOrders[i]);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Bill of Lading ${escapeHtml(bol.bolNumber)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: ${forPrint ? "0.35in" : "16px"};
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10px;
      color: #000;
      background: #fff;
    }
    .bol { max-width: 850px; margin: 0 auto; border: 1px solid #000; }
    .hdr {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: end;
      padding: 6px 8px;
      border-bottom: 1px solid #000;
    }
    .hdr h1 { margin: 0; font-family: "Times New Roman", Times, serif; font-size: 20px; text-align: center; letter-spacing: 0.04em; }
    .hdr .right { text-align: right; }
    .row { display: grid; grid-template-columns: 1.1fr 0.9fr; }
    .cell { border-right: 1px solid #000; border-bottom: 1px solid #000; padding: 0; }
    .cell:last-child { border-right: none; }
    .bar {
      background: #000;
      color: #fff;
      font-weight: 700;
      font-size: 9px;
      padding: 3px 6px;
      letter-spacing: 0.03em;
    }
    .pad { padding: 4px 6px; min-height: 18px; }
    .lbl { font-size: 9px; }
    .val { font-weight: 700; font-size: 11px; }
    .barcode {
      min-height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #666;
      letter-spacing: 0.2em;
      font-size: 9px;
      border-bottom: 1px solid #000;
    }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #000; padding: 3px 4px; vertical-align: top; }
    th { background: #ececec; font-size: 8px; text-transform: uppercase; }
    .sig { display: grid; grid-template-columns: 1fr 1fr 1fr; }
    .sig .cell { min-height: 110px; padding: 6px; font-size: 8px; }
    .check { display: inline-block; width: 10px; height: 10px; border: 1px solid #000; text-align: center; line-height: 9px; font-size: 8px; margin-right: 4px; }
    .muted { color: #444; font-size: 8px; }
    .stamp {
      writing-mode: vertical-rl;
      text-orientation: mixed;
      text-align: center;
      letter-spacing: 0.15em;
      color: #666;
      font-weight: 700;
      background: #f5f5f5;
    }
  </style>
</head>
<body>
  <div class="bol">
    <div class="hdr">
      <div><span class="lbl">Date:</span> <span class="val">${escapeHtml(bol.date)}</span></div>
      <h1>BILL OF LADING</h1>
      <div class="right">${escapeHtml(bol.pageLabel)}</div>
    </div>

    <div class="row">
      <div class="cell">
        <div class="bar">SHIP FROM</div>
        <div class="pad">
          <div><span class="lbl">Name:</span> <span class="val">${escapeHtml(bol.shipFrom.name)}</span></div>
          <div><span class="lbl">Address:</span> ${escapeHtml(bol.shipFrom.address)}</div>
          <div><span class="lbl">City/State/Zip:</span> ${escapeHtml(bol.shipFrom.cityStateZip)}</div>
          <div><span class="lbl">SID#:</span> ${escapeHtml(bol.shipFrom.sid || "")}</div>
        </div>
      </div>
      <div class="cell">
        <div class="pad"><span class="lbl">Bill of Lading Number:</span><div class="val" style="font-size:14px">${escapeHtml(bol.bolNumber)}</div></div>
        <div class="barcode">BAR CODE SPACE</div>
      </div>
    </div>

    <div class="row">
      <div class="cell">
        <div class="bar">SHIP TO</div>
        <div class="pad">
          <div><span class="lbl">Name:</span> <span class="val">${escapeHtml(bol.shipTo.name)}</span></div>
          <div><span class="lbl">Address:</span> ${escapeHtml(bol.shipTo.address)}</div>
          <div><span class="lbl">City/State/Zip:</span> ${escapeHtml(bol.shipTo.cityStateZip)}</div>
          <div><span class="lbl">CID#:</span> ${escapeHtml(bol.shipTo.cid || "")}
            &nbsp;&nbsp;<span class="lbl">Location #:</span> ${escapeHtml(bol.shipTo.locationNumber || "")}</div>
        </div>
      </div>
      <div class="cell">
        <div class="pad">
          <div><span class="lbl">CARRIER NAME:</span> <span class="val">${escapeHtml(bol.carrierName)}</span></div>
          <div><span class="lbl">Trailer number:</span> ${escapeHtml(bol.trailerNumber)}</div>
          <div><span class="lbl">Seal number(s):</span> ${escapeHtml(bol.sealNumbers)}</div>
          <div><span class="lbl">SCAC:</span> ${escapeHtml(bol.scac)}
            &nbsp;&nbsp;<span class="lbl">Pro number:</span> ${escapeHtml(bol.proNumber)}</div>
        </div>
      </div>
    </div>

    <div class="row">
      <div class="cell">
        <div class="bar">THIRD PARTY FREIGHT CHARGES BILL TO:</div>
        <div class="pad">
          <div><span class="lbl">Name:</span> <span class="val">${escapeHtml(bol.billTo.name)}</span></div>
          <div><span class="lbl">Address:</span> ${escapeHtml(bol.billTo.address)}</div>
          <div><span class="lbl">City/State/Zip:</span> ${escapeHtml(bol.billTo.cityStateZip)}</div>
        </div>
      </div>
      <div class="cell">
        <div class="barcode">BAR CODE SPACE</div>
        <div class="pad">
          <div class="muted">Freight Charge Terms: (freight charges are prepaid unless marked otherwise)</div>
          <div style="margin-top:4px">
            <span class="check">${term === "PREPAID" ? "X" : ""}</span>Prepaid
            &nbsp;<span class="check">${term === "COLLECT" ? "X" : ""}</span>Collect
            &nbsp;<span class="check">${term === "THIRD_PARTY" ? "X" : ""}</span>3rd Party
          </div>
        </div>
      </div>
    </div>

    <div class="row">
      <div class="cell">
        <div class="bar">SPECIAL INSTRUCTIONS:</div>
        <div class="pad" style="min-height:42px">${escapeHtml(bol.specialInstructions)}</div>
      </div>
      <div class="cell">
        <div class="pad" style="min-height:42px">
          <span class="check">${bol.masterBol ? "X" : ""}</span>
          Master Bill of Lading: with attached underlying Bills of Lading
        </div>
      </div>
    </div>

    <div class="bar">CUSTOMER ORDER INFORMATION</div>
    <table>
      <thead>
        <tr>
          <th>Customer Order Number</th>
          <th># Pkgs</th>
          <th>Weight</th>
          <th>Pallet/Slip</th>
          <th>Additional Shipper Info</th>
        </tr>
      </thead>
      <tbody>
        ${orderRows
          .map(
            (row) => `<tr>
            <td>${escapeHtml(row?.orderNumber || "")}</td>
            <td>${escapeHtml(row?.pkgs || "")}</td>
            <td>${escapeHtml(row?.weight || "")}</td>
            <td style="text-align:center">Y / N</td>
            <td>${escapeHtml(row?.additionalInfo || "")}</td>
          </tr>`
          )
          .join("")}
        <tr>
          <td><strong>GRAND TOTAL</strong></td>
          <td>${escapeHtml(bol.packageQty)}</td>
          <td>${escapeHtml(bol.weight)}</td>
          <td colspan="2"></td>
        </tr>
      </tbody>
    </table>

    <div class="bar">CARRIER INFORMATION</div>
    <table>
      <thead>
        <tr>
          <th colspan="2">Handling Unit</th>
          <th colspan="2">Package</th>
          <th rowspan="2">Weight</th>
          <th rowspan="2">H.M.</th>
          <th rowspan="2">Commodity Description</th>
          <th colspan="2">LTL Only</th>
          <th rowspan="2" class="stamp">Receiving Stamp</th>
        </tr>
        <tr>
          <th>Qty</th><th>Type</th><th>Qty</th><th>Type</th><th>NMFC #</th><th>Class</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${escapeHtml(bol.handlingUnitQty)}</td>
          <td>${escapeHtml(bol.handlingUnitType)}</td>
          <td>${escapeHtml(bol.packageQty)}</td>
          <td>${escapeHtml(bol.packageType)}</td>
          <td>${escapeHtml(bol.weight)}</td>
          <td style="text-align:center">${bol.hazardous ? "X" : ""}</td>
          <td>${escapeHtml(bol.commodity)}</td>
          <td>${escapeHtml(bol.nmfc)}</td>
          <td>${escapeHtml(bol.freightClass)}</td>
          <td rowspan="2"></td>
        </tr>
        <tr>
          <td colspan="4"><strong>GRAND TOTAL</strong></td>
          <td>${escapeHtml(bol.weight)}</td>
          <td colspan="4"></td>
        </tr>
      </tbody>
    </table>

    <div class="pad muted">
      NOTE Liability Limitation for loss or damage in this shipment may be applicable. See 49 U.S.C. § 14706(c)(1)(A) and (B).
    </div>

    <div class="sig">
      <div class="cell">
        <strong>SHIPPER SIGNATURE / DATE</strong>
        <p class="muted">This is to certify that the above named materials are properly classified, packaged, marked and labeled, and are in proper condition for transportation according to the applicable regulations of the DOT.</p>
        <p style="margin-top:28px;border-top:1px solid #000;padding-top:4px">Shipper Signature</p>
      </div>
      <div class="cell">
        <strong>Trailer Loaded:</strong><br/>
        <span class="check"></span>By Shipper<br/>
        <span class="check"></span>By Driver<br/><br/>
        <strong>Freight Counted:</strong><br/>
        <span class="check"></span>By Shipper<br/>
        <span class="check"></span>By Driver/pallets said to contain<br/>
        <span class="check"></span>By Driver/Pieces
      </div>
      <div class="cell">
        <strong>CARRIER SIGNATURE / PICKUP DATE</strong>
        <p class="muted">Carrier acknowledges receipt of packages and required placards. Property described above is received in good order, except as noted.</p>
        <p style="margin-top:28px;border-top:1px solid #000;padding-top:4px">Carrier Signature</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function renderDocumentHtml(
  doc: StructuredDocument,
  options?: { logoDataUrl?: string | null; forPrint?: boolean }
) {
  if (doc.type === "BOL" && doc.bol) {
    return renderBolHtml(doc, options?.forPrint);
  }

  const logoBlock = options?.logoDataUrl
    ? `<img src="${options.logoDataUrl}" alt="Company logo" class="logo" />`
    : `<div class="logo-placeholder">Logo</div>`;

  const contactBits = [
    doc.company.phone ? escapeHtml(doc.company.phone) : "",
    doc.company.email ? escapeHtml(doc.company.email) : "",
    doc.company.website ? escapeHtml(doc.company.website) : ""
  ].filter(Boolean);

  const detailsRows = doc.details
    .map(
      (item) =>
        `<tr><th>${escapeHtml(item.label)}</th><td>${escapeHtml(item.value)}</td></tr>`
    )
    .join("");

  const stopsRows = doc.stops
    .map(
      (stop) => `<tr>
        <td>${stop.sequence}</td>
        <td>${escapeHtml(stop.type)}</td>
        <td>
          <strong>${escapeHtml(stop.facilityName)}</strong><br/>
          ${escapeHtml(stop.addressLine || "N/A")}<br/>
          <span class="muted">Appt: ${escapeHtml(stop.appointment)}</span>
          ${stop.instructions ? `<br/><span class="muted">${escapeHtml(stop.instructions)}</span>` : ""}
        </td>
      </tr>`
    )
    .join("");

  const chargesHeading = doc.type === "RATE_CONFIRMATION" ? "Carrier Pay" : "Charges";
  const chargesSection = doc.charges?.length
    ? `<section>
        <h2>${chargesHeading}</h2>
        <table class="charges">
          <thead><tr><th>Description</th><th class="num">Amount</th></tr></thead>
          <tbody>
            ${doc.charges
              .map(
                (charge) =>
                  `<tr><td>${escapeHtml(charge.label)}</td><td class="num">${formatMoney(charge.amountCents)}</td></tr>`
              )
              .join("")}
            ${
              doc.totalCents != null
                ? `<tr class="total"><td>Total</td><td class="num">${formatMoney(doc.totalCents)}</td></tr>`
                : ""
            }
          </tbody>
        </table>
      </section>`
    : doc.totalCents != null
      ? `<section><h2>Total</h2><p class="total-line">${formatMoney(doc.totalCents)}</p></section>`
      : "";

  const extraSections = (doc.extraSections ?? [])
    .map(
      (section) => `<section>
        <h2>${escapeHtml(section.title)}</h2>
        <p class="pre">${section.lines.map(escapeHtml).join("<br/>")}</p>
      </section>`
    )
    .join("");

  const remittance = doc.remittance?.length
    ? `<section>
        <h2>Remit Payment To</h2>
        <p class="pre">${doc.remittance.map(escapeHtml).join("<br/>")}</p>
      </section>`
    : "";

  const terms = doc.terms.length
    ? `<section>
        <h2>Terms</h2>
        <ul>${doc.terms.map((term) => `<li>${escapeHtml(term)}</li>`).join("")}</ul>
      </section>`
    : "";

  const signatures = doc.signatures.length
    ? `<section>
        <h2>Authorized Signature</h2>
        ${doc.signatures.map((line) => `<p class="signature">${escapeHtml(line)}</p>`).join("")}
      </section>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(doc.title)} ${escapeHtml(doc.documentNumber)}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: ${options?.forPrint ? "0.5in" : "24px"};
      font-family: "Segoe UI", Arial, Helvetica, sans-serif;
      color: #1e293b;
      font-size: 12px;
      line-height: 1.45;
      background: #fff;
    }
    .sheet { max-width: 800px; margin: 0 auto; }
    .letterhead {
      display: flex;
      gap: 20px;
      align-items: flex-start;
      justify-content: space-between;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .brand { display: flex; gap: 16px; align-items: flex-start; }
    .logo, .logo-placeholder {
      width: 96px;
      height: 64px;
      object-fit: contain;
      flex-shrink: 0;
    }
    .logo-placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px dashed #94a3b8;
      color: #94a3b8;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .company-name { font-size: 18px; font-weight: 700; margin: 0 0 4px; color: #0f172a; }
    .meta-block { text-align: right; min-width: 180px; }
    .doc-title { font-size: 16px; font-weight: 700; margin: 0 0 6px; letter-spacing: 0.02em; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 18px; }
    .panel {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 14px;
      background: #f8fafc;
    }
    .panel h2, section h2 {
      margin: 0 0 8px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #475569;
    }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    table.details th {
      text-align: left;
      width: 140px;
      padding: 4px 8px 4px 0;
      color: #64748b;
      font-weight: 600;
      vertical-align: top;
    }
    table.details td { padding: 4px 0; }
    table.stops th, table.charges th {
      text-align: left;
      background: #0f172a;
      color: #fff;
      padding: 8px 10px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    table.stops td, table.charges td {
      border-bottom: 1px solid #e2e8f0;
      padding: 8px 10px;
      vertical-align: top;
    }
    .num { text-align: right; white-space: nowrap; }
    tr.total td { font-weight: 700; border-top: 2px solid #0f172a; }
    .muted { color: #64748b; }
    .pre { margin: 0; white-space: pre-wrap; }
    ul { margin: 0; padding-left: 18px; }
    li { margin-bottom: 4px; }
    .signature { margin: 18px 0 0; font-family: inherit; }
    .total-line { font-size: 16px; font-weight: 700; }
    @media print {
      body { padding: 0; }
      .panel { background: #fff; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <header class="letterhead">
      <div class="brand">
        ${logoBlock}
        <div>
          <p class="company-name">${escapeHtml(doc.company.name)}</p>
          <div class="muted">
            ${doc.company.addressLines.map(escapeHtml).join("<br/>")}
            ${contactBits.length ? `<br/>${contactBits.join(" · ")}` : ""}
          </div>
        </div>
      </div>
      <div class="meta-block">
        <p class="doc-title">${escapeHtml(doc.title)}</p>
        <div><strong>#</strong> ${escapeHtml(doc.documentNumber)}</div>
        <div><strong>Load</strong> ${escapeHtml(doc.loadNumber)}</div>
        <div><strong>${escapeHtml(doc.dateLabel)}</strong> ${escapeHtml(doc.issuedDate)}</div>
        ${doc.dueDate ? `<div><strong>Due</strong> ${escapeHtml(doc.dueDate)}</div>` : ""}
      </div>
    </header>

    <div class="grid-2">
      <div class="panel">
        <h2>${escapeHtml(doc.partyTitle)}</h2>
        <p class="pre">${doc.partyLines.map(escapeHtml).join("<br/>")}</p>
      </div>
      <div class="panel">
        <h2>Shipment Details</h2>
        <table class="details"><tbody>${detailsRows}</tbody></table>
      </div>
    </div>

    <section>
      <h2>Stops</h2>
      <table class="stops">
        <thead><tr><th>#</th><th>Type</th><th>Location</th></tr></thead>
        <tbody>${stopsRows}</tbody>
      </table>
    </section>

    ${extraSections}
    ${chargesSection}
    ${remittance}
    ${terms}
    ${signatures}
  </div>
</body>
</html>`;
}
