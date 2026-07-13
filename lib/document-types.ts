import { documentTypes } from "@/lib/constants";
import { humanize } from "@/lib/format";

export function serializeDocumentTypes(types: string[]) {
  const normalized = types.map((type) => type.trim()).filter(Boolean);
  return normalized.length ? JSON.stringify(normalized) : null;
}

export function parseDocumentTypes(value?: string | null) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [value];
    }

    return parsed.map((item) => String(item).trim()).filter(Boolean);
  } catch {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
}

export function primaryDocumentType(types: string[], fallback = "OTHER") {
  return types[0] ?? fallback;
}

export function formatDocumentTypeLabel(type: string) {
  if ((documentTypes as readonly string[]).includes(type)) {
    return humanize(type);
  }

  return type;
}

export function parseDocumentTypesFromForm(formData: FormData) {
  const raw = String(formData.get("types") ?? "").trim();
  if (!raw) {
    const single = String(formData.get("type") ?? "").trim();
    return single ? [single] : ["OTHER"];
  }

  return parseDocumentTypes(raw);
}
