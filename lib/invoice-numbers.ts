/**
 * Invoice numbers match the load: INV-{loadNumber}.
 * Example: load 2491 → INV-2491
 */
export function invoiceNumberForLoad(loadNumber: string): string {
  const trimmed = loadNumber.trim();
  if (!trimmed) {
    throw new Error("Load number is required to build an invoice number.");
  }
  return `INV-${trimmed}`;
}
