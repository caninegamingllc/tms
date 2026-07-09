export function normalizeCarrierNumber(value?: string) {
  const normalized = value?.replace(/[^a-z0-9]/gi, "").toUpperCase();
  return normalized || undefined;
}

export function formatMcNumber(value?: string | number | null) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const digits = String(value).replace(/\D/g, "");
  return digits ? `MC-${digits}` : undefined;
}

export function formatDotNumber(value?: string | number | null) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const digits = String(value).replace(/\D/g, "");
  return digits || undefined;
}
