import { formatMoney } from "@/lib/format";
import type { StructuredDocument } from "@/lib/document-templates";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderDocumentHtml(
  doc: StructuredDocument,
  options?: { logoDataUrl?: string | null; forPrint?: boolean }
) {
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
