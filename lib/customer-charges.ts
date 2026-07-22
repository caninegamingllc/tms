import type { Prisma, PrismaClient } from "@prisma/client";
import { assertMoneyCentsFitInt4 } from "@/lib/format";
import { LATE_FEE_CHARGE_TYPE } from "@/lib/late-fees";

type CatalogDb = PrismaClient | Prisma.TransactionClient;

export type ParsedCustomerChargeLine = {
  lineTypeId: string;
  label: string;
  chargeType: string;
  description: string | null;
  unitRateCents: number;
  quantity: number;
  amountCents: number;
  sortOrder: number;
};

type RawCustomerChargeLine = {
  lineTypeId: string;
  description?: string | null;
  unitRateCents: number;
  quantity: number;
  amountCents?: number;
  sortOrder?: number;
};

export async function parseCustomerChargesFromForm(
  formData: FormData,
  companyId: string,
  db: CatalogDb,
  options?: { fieldName?: string; requireAtLeastOne?: boolean }
): Promise<ParsedCustomerChargeLine[]> {
  const fieldName = options?.fieldName ?? "customerChargesJson";
  const requireAtLeastOne = options?.requireAtLeastOne ?? true;
  const raw = String(formData.get(fieldName) ?? "").trim();

  if (!raw) {
    if (requireAtLeastOne) {
      throw new Error("Add at least one customer charge line item.");
    }
    return [];
  }

  let parsedLines: RawCustomerChargeLine[];
  try {
    parsedLines = JSON.parse(raw);
  } catch {
    throw new Error("Invalid customer charge line items.");
  }

  if (!Array.isArray(parsedLines) || (requireAtLeastOne && parsedLines.length === 0)) {
    throw new Error("Add at least one customer charge line item.");
  }

  const lineTypeIds = [...new Set(parsedLines.map((line) => line.lineTypeId).filter(Boolean))];
  const lineTypes = await db.customerChargeType.findMany({
    where: { companyId, id: { in: lineTypeIds } }
  });
  const typeById = new Map(lineTypes.map((type) => [type.id, type]));

  return parsedLines.map((line, index) => {
    const lineType = typeById.get(line.lineTypeId);
    if (!lineType) {
      throw new Error("Invalid customer charge type.");
    }

    const unitRateCents = Math.max(0, Math.round(Number(line.unitRateCents) || 0));
    const quantityRaw = Number(line.quantity);
    const quantity =
      lineType.calculationMethod === "FLAT"
        ? 1
        : Number.isFinite(quantityRaw) && quantityRaw > 0
          ? quantityRaw
          : 0;
    if (lineType.calculationMethod !== "FLAT" && quantity <= 0) {
      throw new Error(`${lineType.name} requires a quantity.`);
    }

    const amountCents =
      lineType.calculationMethod === "PER_MILE" || lineType.calculationMethod === "HOURLY"
        ? Math.round(unitRateCents * quantity)
        : unitRateCents;

    assertMoneyCentsFitInt4(unitRateCents, `${lineType.name} rate`);
    assertMoneyCentsFitInt4(amountCents, `${lineType.name} amount`);

    return {
      lineTypeId: lineType.id,
      label: lineType.name,
      chargeType: lineType.name,
      description: line.description?.trim() || null,
      unitRateCents,
      quantity,
      amountCents,
      sortOrder: Number.isFinite(line.sortOrder) ? Number(line.sortOrder) : index
    };
  });
}

export function customerChargesTotalCents(lines: Array<{ amountCents: number }>) {
  return lines.reduce((sum, line) => sum + line.amountCents, 0);
}

export function isLateFeeCharge(charge: { chargeType: string }) {
  return charge.chargeType === LATE_FEE_CHARGE_TYPE;
}

export function chargesCreateData(lines: ParsedCustomerChargeLine[]): Prisma.LoadChargeCreateWithoutLoadInput[] {
  return lines.map((line) => ({
    lineTypeId: line.lineTypeId,
    label: line.label,
    chargeType: line.chargeType,
    description: line.description,
    unitRateCents: line.unitRateCents,
    quantity: line.quantity,
    amountCents: line.amountCents,
    sortOrder: line.sortOrder
  }));
}
