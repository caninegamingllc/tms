import { readFileSync } from "fs";

export type AscendLoadRow = Record<string, string>;

export type ParsedStop = {
  sequence: number;
  type: "PICKUP" | "DELIVERY";
  facilityName: string;
  appointmentAt: Date | null;
};

const KNOWN_BRANCHES = new Set([
  "Phillips Expedited",
  "Matt Boreako",
  "Corey Horvath",
  "Suki Hamzic",
  "Billy Parker",
  "Talent Transport Logistics"
]);

export function parseAscendCsv(filePath: string): AscendLoadRow[] {
  const text = readFileSync(filePath, "utf8");
  const matrix = parseCsvMatrix(text);
  if (matrix.length < 2) {
    return [];
  }

  const headers = matrix[0];
  return matrix.slice(1).map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]))
  );
}

function parseCsvMatrix(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (inQuotes) {
      if (char === '"' && input[index + 1] === '"') {
        current += '"';
        index += 1;
        continue;
      }
      if (char === '"') {
        inQuotes = false;
        continue;
      }
      current += char;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      row.push(current);
      current = "";
      continue;
    }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && input[index + 1] === "\n") {
        index += 1;
      }
      row.push(current);
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
      current = "";
      continue;
    }
    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  return rows;
}

export function normalizeBranch(rawBranch: string): string {
  const trimmed = rawBranch.trim();
  if (trimmed === "Talent Transport Logistics Inc") {
    return "Talent Transport Logistics";
  }
  if (trimmed === "Shared") {
    return "Suki Hamzic";
  }
  return trimmed;
}

export function assertKnownBranch(branch: string): string {
  const normalized = normalizeBranch(branch);
  if (!KNOWN_BRANCHES.has(normalized)) {
    throw new Error(`Unknown branch "${branch}" (normalized: "${normalized}")`);
  }
  return normalized;
}

export function parseMoneyToCents(value: string | null | undefined): number {
  const numeric = Number(String(value ?? "0").replace(/[^0-9.-]/g, ""));
  return Math.round((Number.isFinite(numeric) ? numeric : 0) * 100);
}

export function parseAscendDate(value: string | null | undefined, fallback = new Date()): Date {
  const trimmed = String(value ?? "").trim();
  if (!trimmed || trimmed.toUpperCase() === "INVALID DATE") {
    return fallback;
  }

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (slashMatch) {
    const [, month, day, year, hour = "0", minute = "0"] = slashMatch;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute)
    );
  }

  const iso = new Date(trimmed);
  if (!Number.isNaN(iso.getTime())) {
    return iso;
  }

  return fallback;
}

export function parseOptionalDate(value: string | null | undefined): Date | null {
  const trimmed = String(value ?? "").trim();
  if (!trimmed || trimmed.toUpperCase() === "INVALID DATE") {
    return null;
  }
  return parseAscendDate(trimmed);
}

export function parseWeight(value: string | null | undefined): number | undefined {
  const numeric = Number(String(value ?? "").replace(/[^0-9]/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : undefined;
}

const STOP_LINE =
  /^\s*(\d+)\.\s*(Pickup|Delivery):\s*(.+?)\s+(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2})\s*$/i;

export function parseStops(allStops: string): ParsedStop[] {
  const stops: ParsedStop[] = [];

  for (const line of allStops.split(/\r?\n/)) {
    const match = line.trim().match(STOP_LINE);
    if (!match) {
      continue;
    }

    const [, sequence, type, facilityName, dateText] = match;
    stops.push({
      sequence: Number(sequence),
      type: type.toUpperCase() === "PICKUP" ? "PICKUP" : "DELIVERY",
      facilityName: facilityName.trim(),
      appointmentAt: parseOptionalDate(dateText)
    });
  }

  return stops.sort((a, b) => a.sequence - b.sequence);
}

export function mapEquipment(raw: string): string {
  const value = raw.trim();
  if (!value) {
    return "Dry Van";
  }
  const lower = value.toLowerCase();
  if (lower.includes("power only")) {
    return "Power Only";
  }
  if (lower.includes("reefer")) {
    return "Reefer";
  }
  if (lower.includes("step deck")) {
    return "Step Deck";
  }
  if (lower.includes("box truck") || lower.includes("straight box") || lower.includes("hotshot")) {
    return "Box Truck";
  }
  if (
    lower.includes("flatbed") ||
    lower.includes("conestoga") ||
    lower.includes("lowboy") ||
    lower.includes("gooseneck")
  ) {
    return "Flatbed";
  }
  if (lower.includes("van") || lower.includes("ltl")) {
    return "Dry Van";
  }
  return "Dry Van";
}

export function mapLoadStatus(input: {
  ascendStatus: string;
  invoiceBalanceCents: number;
  invoicePaymentDate: Date | null;
  invoiceDate: Date | null;
}): string {
  const status = input.ascendStatus.trim().toLowerCase();

  let mapped = "PENDING";
  if (status === "completed" || status === "delivered") {
    mapped = "DELIVERED";
  } else if (status === "to be billed") {
    mapped = "INVOICED";
  } else if (status === "dispatched") {
    mapped = "DISPATCHED";
  } else if (status === "in transit") {
    mapped = "PICKED_UP";
  } else if (
    status === "booked - awaiting confirmation" ||
    status === "needs carrier" ||
    status === "open" ||
    status === "booked"
  ) {
    mapped = "PENDING";
  }

  if (
    mapped === "INVOICED" &&
    input.invoicePaymentDate &&
    input.invoiceBalanceCents === 0
  ) {
    return "PAID";
  }

  if (mapped === "DELIVERED" && input.invoiceDate) {
    return "INVOICED";
  }

  if (mapped === "DELIVERED" && input.invoicePaymentDate && input.invoiceBalanceCents === 0) {
    return "PAID";
  }

  return mapped;
}

export function mapInvoiceStatus(input: {
  invoiceDate: Date | null;
  invoiceSentDate: Date | null;
  invoicePaymentDate: Date | null;
  invoiceBalanceCents: number;
}): string | null {
  if (!input.invoiceDate && !input.invoiceSentDate) {
    return null;
  }
  if (input.invoicePaymentDate && input.invoiceBalanceCents === 0) {
    return "PAID";
  }
  if (input.invoiceSentDate || input.invoiceDate) {
    return "SENT";
  }
  return "DRAFT";
}

export function mapCarrierBillStatus(billPaymentDate: Date | null): string {
  return billPaymentDate ? "PAID" : "APPROVED";
}

export function extractBrokerAgent(usersAndRoles: string): string | null {
  const match = usersAndRoles.match(/BrokerAgent:\s*(.+)/i);
  return match ? match[1].trim() : null;
}

export function buildLoadTitle(
  pickupCity: string,
  pickupState: string,
  deliveryCity: string,
  deliveryState: string
) {
  return `${pickupCity}, ${pickupState} → ${deliveryCity}, ${deliveryState}`;
}

export function normalizeMcNumber(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.startsWith("MC") ? trimmed : `MC${trimmed.replace(/^MC/i, "")}`;
}

export function normalizeDotNumber(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.startsWith("DOT") ? trimmed : `DOT${trimmed.replace(/^DOT/i, "")}`;
}

export function facilityNameMatches(a: string, b: string): boolean {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  if (!left || !right) {
    return false;
  }
  return left === right || left.includes(right) || right.includes(left);
}

export type StopAddress = {
  facilityName: string;
  address?: string;
  city: string;
  state: string;
  postalCode?: string;
};

export function resolveStopAddress(
  stop: ParsedStop,
  row: AscendLoadRow
): StopAddress {
  const firstPickName = row["First Pick Name"]?.trim() ?? "";
  const lastDropName = row["Last Drop Name"]?.trim() ?? "";

  if (facilityNameMatches(stop.facilityName, firstPickName)) {
    return {
      facilityName: firstPickName || stop.facilityName,
      address: row["First Pick Address"]?.trim() || undefined,
      city: row["First Pick City"]?.trim() || "Unknown",
      state: row["First Pick State"]?.trim() || "NA",
      postalCode: row["First Pick Postal"]?.trim() || undefined
    };
  }

  if (facilityNameMatches(stop.facilityName, lastDropName)) {
    return {
      facilityName: lastDropName || stop.facilityName,
      address: row["Last Drop Address"]?.trim() || undefined,
      city: row["Last Drop City"]?.trim() || "Unknown",
      state: row["Last Drop State"]?.trim() || "NA",
      postalCode: row["Last Drop Postal"]?.trim() || undefined
    };
  }

  return {
    facilityName: stop.facilityName,
    city: row["First Pick City"]?.trim() || "Unknown",
    state: row["First Pick State"]?.trim() || "NA"
  };
}

export function fallbackStops(row: AscendLoadRow): ParsedStop[] {
  return [
    {
      sequence: 1,
      type: "PICKUP",
      facilityName: row["First Pick Name"]?.trim() || "Pickup",
      appointmentAt: parseOptionalDate(row["First Pick Date"])
    },
    {
      sequence: 2,
      type: "DELIVERY",
      facilityName: row["Last Drop Name"]?.trim() || "Delivery",
      appointmentAt: parseOptionalDate(row["Last Drop Date"])
    }
  ];
}
