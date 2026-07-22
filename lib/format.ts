export function formatMoney(cents = 0) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(cents / 100);
}

export function formatDate(date?: Date | string | null) {
  if (!date) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(date));
}

export function formatDateTime(date?: Date | string | null) {
  if (!date) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(date));
}

/** Postgres `integer` / Prisma `Int` bounds (signed 32-bit). */
export const POSTGRES_INT4_MAX = 2_147_483_647;
export const POSTGRES_INT4_MIN = -2_147_483_648;
/** Largest dollar amount that still fits when stored as cents in Int4. */
export const MAX_MONEY_DOLLARS = Math.floor(POSTGRES_INT4_MAX / 100);

export function assertFitsInt4(value: number, label: string) {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a valid number.`);
  }
  if (value > POSTGRES_INT4_MAX || value < POSTGRES_INT4_MIN) {
    throw new Error(
      `${label} is too large (max ${POSTGRES_INT4_MAX.toLocaleString("en-US")}). Check weights (lbs) and dollar amounts.`
    );
  }
}

export function assertMoneyCentsFitInt4(cents: number, label: string) {
  if (!Number.isFinite(cents)) {
    throw new Error(`${label} must be a valid amount.`);
  }
  if (cents > POSTGRES_INT4_MAX || cents < POSTGRES_INT4_MIN) {
    throw new Error(
      `${label} is too large (max about $${MAX_MONEY_DOLLARS.toLocaleString("en-US")}). Use a smaller amount.`
    );
  }
}

export function parseMoneyToCents(value: FormDataEntryValue | null) {
  const numeric = Number(String(value ?? "0").replace(/[^0-9.-]/g, ""));
  return Math.round((Number.isFinite(numeric) ? numeric : 0) * 100);
}

export function marginCents(revenueCents = 0, carrierCostCents = 0) {
  return revenueCents - carrierCostCents;
}

export function marginPercent(revenueCents = 0, carrierCostCents = 0) {
  if (!revenueCents) {
    return "0%";
  }

  return `${Math.round((marginCents(revenueCents, carrierCostCents) / revenueCents) * 100)}%`;
}

export function humanize(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function commissionMethodLabel(method: string) {
  switch (method) {
    case "STANDARD_SPLIT":
      return "Standard split";
    case "EXPENSE_FLOOR":
      return "Expense floor";
    case "INELIGIBLE":
      return "Ineligible";
    case "NO_PROFIT":
      return "No profit";
    default:
      return humanize(method);
  }
}
