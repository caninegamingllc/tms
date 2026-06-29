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
