/** Bump when Privacy Policy or Terms of Service substantive text changes. */
export const LEGAL_DOCUMENT_VERSION = "2026-07-15";

export const LEGAL_CONTACT_EMAIL = "privacy@simple-source.com";

export const LEGAL_COMPANY_NAME = "Talent Transport Logistics Inc.";

export const LEGAL_PRODUCT_NAME = "Simple Source TMS";

export const LEGAL_SERVICE_URL = "https://tms.simple-source.com";

export function didAcceptLegal(formData: FormData) {
  return String(formData.get("acceptedLegal") ?? "") === "on";
}

export function legalAcceptanceData(now = new Date()) {
  return {
    legalAcceptedAt: now,
    legalDocumentVersion: LEGAL_DOCUMENT_VERSION
  };
}
