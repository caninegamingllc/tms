import type { Prisma, PrismaClient } from "@prisma/client";
import { ensureCompanyCatalogs } from "@/lib/catalogs";
import { driverPayCalculationMethods } from "@/lib/constants";

type Db = PrismaClient | Prisma.TransactionClient;

export type DriverPayLineInput = {
  lineTypeId: string;
  description?: string | null;
  unitRateCents: number;
  quantity: number;
  percent?: number | null;
  amountCents: number;
};

export function eligibleRevenueCents(
  charges: Array<{
    amountCents: number;
    lineTypeId?: string | null;
    lineType?: { includeInDriverPay: boolean } | null;
  }>
) {
  return charges.reduce((sum, charge) => {
    if (charge.lineType && charge.lineType.includeInDriverPay === false) {
      return sum;
    }
    return sum + charge.amountCents;
  }, 0);
}

export function computeDriverPayLineAmountCents(params: {
  calculationMethod: string;
  unitRateCents: number;
  quantity: number;
  percent?: number | null;
  eligibleRevenueCents: number;
}) {
  const method = params.calculationMethod;
  if (method === "PER_MILE") {
    return Math.round(params.unitRateCents * (params.quantity || 0));
  }
  if (method === "PERCENT_REVENUE") {
    const pct = params.percent ?? 0;
    return Math.round((params.eligibleRevenueCents * pct) / 100);
  }
  return params.unitRateCents;
}

export async function syncLoadDriverPayCents(db: Db, loadId: string) {
  const agg = await db.driverPayLine.aggregate({
    where: { loadId },
    _sum: { amountCents: true }
  });
  const total = agg._sum.amountCents ?? 0;
  await db.load.update({
    where: { id: loadId },
    data: { driverPayCents: total }
  });
  return total;
}

export async function recalcDriverPayLinesForLoad(db: Db, loadId: string) {
  const load = await db.load.findUnique({
    where: { id: loadId },
    include: {
      charges: { include: { lineType: true } },
      driverPayLines: { include: { lineType: true } }
    }
  });
  if (!load) return;

  const eligible = eligibleRevenueCents(load.charges);
  const miles = load.routeTotalMiles ?? 0;

  for (const line of load.driverPayLines) {
    if (line.settlementId) continue;
    const method = line.lineType.calculationMethod;
    let quantity = line.quantity;
    let amountCents = line.amountCents;

    if (method === "PER_MILE") {
      quantity = miles > 0 ? miles : line.quantity;
      amountCents = computeDriverPayLineAmountCents({
        calculationMethod: method,
        unitRateCents: line.unitRateCents,
        quantity,
        eligibleRevenueCents: eligible
      });
    } else if (method === "PERCENT_REVENUE") {
      amountCents = computeDriverPayLineAmountCents({
        calculationMethod: method,
        unitRateCents: line.unitRateCents,
        quantity: line.quantity,
        percent: line.percent,
        eligibleRevenueCents: eligible
      });
    } else {
      continue;
    }

    await db.driverPayLine.update({
      where: { id: line.id },
      data: { quantity, amountCents }
    });
  }

  await syncLoadDriverPayCents(db, loadId);
}

export async function seedDriverPayLinesFromProfile(
  db: Db,
  params: {
    companyId: string;
    loadId: string;
    assignmentId: string;
    driverId: string;
  }
) {
  await ensureCompanyCatalogs(params.companyId, db);

  const existingCount = await db.driverPayLine.count({ where: { loadId: params.loadId } });
  if (existingCount > 0) return;

  const [driver, load, lineTypes] = await Promise.all([
    db.driver.findFirst({ where: { id: params.driverId, companyId: params.companyId } }),
    db.load.findUnique({
      where: { id: params.loadId },
      include: { charges: { include: { lineType: true } } }
    }),
    db.driverPayLineType.findMany({
      where: { companyId: params.companyId, active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    })
  ]);

  if (!driver || !load) return;

  const method = (driverPayCalculationMethods as readonly string[]).includes(driver.defaultPayMethod)
    ? driver.defaultPayMethod
    : "FLAT";

  const lineType =
    lineTypes.find((t) => t.calculationMethod === method) ??
    lineTypes.find((t) => t.calculationMethod === "FLAT") ??
    lineTypes[0];
  if (!lineType) return;

  const eligible = eligibleRevenueCents(load.charges);
  const miles = load.routeTotalMiles ?? 0;

  let unitRateCents = 0;
  let quantity = 1;
  let percent: number | null = null;
  let amountCents = 0;

  if (method === "FLAT") {
    unitRateCents = driver.defaultFlatCents || 0;
    amountCents = unitRateCents;
  } else if (method === "PER_MILE") {
    unitRateCents = driver.defaultPerMileCents || 0;
    quantity = miles > 0 ? miles : 0;
    amountCents = Math.round(unitRateCents * quantity);
  } else if (method === "PERCENT_REVENUE") {
    percent = driver.defaultRevenuePercent ?? 0;
    amountCents = Math.round((eligible * percent) / 100);
  }

  // Only seed when the profile has a meaningful rate
  const hasRate =
    (method === "FLAT" && unitRateCents > 0) ||
    (method === "PER_MILE" && unitRateCents > 0) ||
    (method === "PERCENT_REVENUE" && (percent ?? 0) > 0);
  if (!hasRate) return;

  await db.driverPayLine.create({
    data: {
      loadId: params.loadId,
      assignmentId: params.assignmentId,
      lineTypeId: lineType.id,
      description: null,
      unitRateCents,
      quantity,
      percent,
      amountCents,
      sortOrder: 0
    }
  });

  await syncLoadDriverPayCents(db, params.loadId);
}

export function parseDriverPayLinesFromForm(formData: FormData): DriverPayLineInput[] {
  const lineTypeIds = formData.getAll("driverPayLineTypeId").map(String);
  const descriptions = formData.getAll("driverPayLineDescription").map(String);
  const unitRates = formData.getAll("driverPayLineUnitRate").map(String);
  const quantities = formData.getAll("driverPayLineQuantity").map(String);
  const percents = formData.getAll("driverPayLinePercent").map(String);
  const amounts = formData.getAll("driverPayLineAmount").map(String);

  const lines: DriverPayLineInput[] = [];
  for (let i = 0; i < lineTypeIds.length; i++) {
    const lineTypeId = lineTypeIds[i]?.trim();
    if (!lineTypeId) continue;
    const unitRateCents = Math.round(Number(unitRates[i] ?? 0) * 100) || Number(unitRates[i]) || 0;
    // unit rates may already be in cents from hidden amount fields — prefer amountCents
    const amountFromForm = Number(amounts[i] ?? 0);
    const quantity = Number(quantities[i] ?? 1);
    const percentRaw = percents[i]?.trim();
    const percent = percentRaw ? Number(percentRaw) : null;

    lines.push({
      lineTypeId,
      description: descriptions[i]?.trim() || null,
      unitRateCents: Number.isFinite(Number(unitRates[i]))
        ? Math.round(Number(unitRates[i]) * 100)
        : 0,
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      percent: percent != null && Number.isFinite(percent) ? percent : null,
      amountCents: Number.isFinite(amountFromForm) ? Math.round(amountFromForm) : 0
    });
  }
  return lines;
}

/** Parse money-style unit rate strings (dollars) from the editor. */
export function parseDriverPayLinesFromEditorForm(formData: FormData): DriverPayLineInput[] {
  const lineTypeIds = formData.getAll("driverPayLineTypeId").map(String);
  const descriptions = formData.getAll("driverPayLineDescription").map(String);
  const unitRates = formData.getAll("driverPayLineUnitRate").map(String);
  const quantities = formData.getAll("driverPayLineQuantity").map(String);
  const percents = formData.getAll("driverPayLinePercent").map(String);

  const lines: DriverPayLineInput[] = [];
  for (let i = 0; i < lineTypeIds.length; i++) {
    const lineTypeId = lineTypeIds[i]?.trim();
    if (!lineTypeId) continue;
    const unitRateStr = (unitRates[i] ?? "").replace(/[$,\s]/g, "");
    const unitRateCents = unitRateStr ? Math.round(Number(unitRateStr) * 100) : 0;
    const quantity = Number(quantities[i] ?? 1);
    const percentRaw = percents[i]?.trim();
    const percent = percentRaw ? Number(percentRaw) : null;

    lines.push({
      lineTypeId,
      description: descriptions[i]?.trim() || null,
      unitRateCents: Number.isFinite(unitRateCents) ? unitRateCents : 0,
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      percent: percent != null && Number.isFinite(percent) ? percent : null,
      amountCents: 0
    });
  }
  return lines;
}

export async function replaceDriverPayLines(
  db: Db,
  params: {
    companyId: string;
    loadId: string;
    assignmentId: string | null;
    lines: DriverPayLineInput[];
  }
) {
  const load = await db.load.findUnique({
    where: { id: params.loadId },
    include: { charges: { include: { lineType: true } } }
  });
  if (!load) throw new Error("Load not found");

  const types = await db.driverPayLineType.findMany({
    where: { companyId: params.companyId, id: { in: params.lines.map((l) => l.lineTypeId) } }
  });
  const typeById = new Map(types.map((t) => [t.id, t]));
  const eligible = eligibleRevenueCents(load.charges);

  await db.driverPayLine.deleteMany({
    where: { loadId: params.loadId, settlementId: null }
  });

  let sortOrder = 0;
  for (const line of params.lines) {
    const type = typeById.get(line.lineTypeId);
    if (!type) continue;
    const amountCents = computeDriverPayLineAmountCents({
      calculationMethod: type.calculationMethod,
      unitRateCents: line.unitRateCents,
      quantity: line.quantity,
      percent: line.percent,
      eligibleRevenueCents: eligible
    });
    await db.driverPayLine.create({
      data: {
        loadId: params.loadId,
        assignmentId: params.assignmentId,
        lineTypeId: line.lineTypeId,
        description: line.description,
        unitRateCents: line.unitRateCents,
        quantity: line.quantity,
        percent: type.calculationMethod === "PERCENT_REVENUE" ? line.percent : null,
        amountCents,
        sortOrder: sortOrder++
      }
    });
  }

  await syncLoadDriverPayCents(db, params.loadId);
}

export function advanceRemainingCents(
  advance: { amountCents: number; applications: Array<{ amountCents: number }> }
) {
  const applied = advance.applications.reduce((sum, a) => sum + a.amountCents, 0);
  return Math.max(0, advance.amountCents - applied);
}
