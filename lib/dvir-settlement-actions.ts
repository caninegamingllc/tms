"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { assertPlanFeature, requireWriteUser } from "@/lib/permissions";
import { parseLocalDateTime } from "@/lib/dates";

function requiredString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) throw new Error(`${key} is required`);
  return value;
}

function optionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || undefined;
}

function optionalDate(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) return null;
  return parseLocalDateTime(value);
}

function optionalInt(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

export async function createDvirReport(formData: FormData) {
  const user = await requireWriteUser();
  await assertPlanFeature(user.companyId, "fleet_assets");

  const inspectionType = optionalString(formData, "inspectionType") ?? "PRE_TRIP";
  const result = optionalString(formData, "result") ?? "SATISFACTORY";
  const defects = optionalString(formData, "defects") ?? "";

  await prisma.dvirReport.create({
    data: {
      companyId: user.companyId,
      driverId: optionalString(formData, "driverId") ?? null,
      truckId: optionalString(formData, "truckId") ?? null,
      trailerId: optionalString(formData, "trailerId") ?? null,
      inspectedAt: optionalDate(formData, "inspectedAt") ?? new Date(),
      inspectionType,
      result,
      odometer: optionalInt(formData, "odometer"),
      defectsJson: defects
        ? JSON.stringify(
            defects
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean)
          )
        : null,
      remarks: optionalString(formData, "remarks") ?? null,
      certifiedSafe: String(formData.get("certifiedSafe") ?? "") === "on"
    }
  });

  revalidatePath("/fleet/dvir");
  redirect("/fleet/dvir?saved=1");
}

export async function createDriverSettlement(formData: FormData) {
  const user = await requireWriteUser();
  await assertPlanFeature(user.companyId, "fleet_dispatch");

  const driverId = requiredString(formData, "driverId");
  const driver = await prisma.driver.findFirst({
    where: { id: driverId, companyId: user.companyId }
  });
  if (!driver) throw new Error("Driver not found");

  const periodStart = optionalDate(formData, "periodStart");
  const periodEnd = optionalDate(formData, "periodEnd");
  if (!periodStart || !periodEnd) {
    throw new Error("Period start and end are required");
  }
  if (periodEnd < periodStart) {
    throw new Error("Period end must be on or after period start");
  }

  const endOfDay = new Date(periodEnd);
  endOfDay.setHours(23, 59, 59, 999);

  const unsettledLines = await prisma.driverPayLine.findMany({
    where: {
      settlementId: null,
      load: {
        companyId: user.companyId,
        deliveryDate: { gte: periodStart, lte: endOfDay },
        status: { in: ["DELIVERED", "INVOICED", "PAID", "PICKED_UP", "DISPATCHED"] },
        dispatchAssignments: { some: { driverId } }
      }
    },
    include: {
      load: { select: { id: true, loadNumber: true, routeTotalMiles: true, revenueCents: true } },
      lineType: true
    },
    orderBy: [{ load: { deliveryDate: "asc" } }, { sortOrder: "asc" }]
  });

  const advances = await prisma.advance.findMany({
    where: {
      companyId: user.companyId,
      driverId,
      payeeType: "DRIVER",
      status: "OPEN",
      issuedAt: { lte: endOfDay }
    },
    include: { applications: true },
    orderBy: { issuedAt: "asc" }
  });

  const { advanceRemainingCents } = await import("@/lib/driver-pay");
  const openAdvances = advances
    .map((advance) => ({ ...advance, remainingCents: advanceRemainingCents(advance) }))
    .filter((advance) => advance.remainingCents > 0);

  if (unsettledLines.length === 0 && openAdvances.length === 0) {
    redirect(
      `/fleet/settlements?error=${encodeURIComponent("No unsettled driver pay or open advances in that period.")}`
    );
  }

  const payCents = unsettledLines.reduce((sum, line) => sum + line.amountCents, 0);
  const deductionsCents = openAdvances.reduce((sum, advance) => sum + advance.remainingCents, 0);
  const miles = unsettledLines.reduce(
    (sum, line) => sum + (line.load.routeTotalMiles ?? 0),
    0
  );
  const revenueCents = unsettledLines.reduce((sum, line) => sum + line.load.revenueCents, 0);
  const methods = new Set(unsettledLines.map((line) => line.lineType.calculationMethod));
  const payMethod =
    methods.size === 0 ? "OTHER" : methods.size === 1 ? [...methods][0] : "MIXED";

  const settlement = await prisma.$transaction(async (tx) => {
    const created = await tx.driverSettlement.create({
      data: {
        companyId: user.companyId,
        driverId,
        periodStart,
        periodEnd,
        payMethod,
        miles,
        revenueCents,
        payCents,
        deductionsCents,
        netCents: payCents - deductionsCents,
        status: "DRAFT",
        notes: optionalString(formData, "notes") ?? null
      }
    });

    let sortOrder = 0;
    for (const line of unsettledLines) {
      await tx.driverSettlementItem.create({
        data: {
          settlementId: created.id,
          kind: "LOAD_PAY",
          label: `${line.load.loadNumber} · ${line.lineType.name}`,
          amountCents: line.amountCents,
          loadId: line.loadId,
          driverPayLineId: line.id,
          sortOrder: sortOrder++
        }
      });
      await tx.driverPayLine.update({
        where: { id: line.id },
        data: { settlementId: created.id, settledAt: new Date() }
      });
    }

    for (const advance of openAdvances) {
      await tx.driverSettlementItem.create({
        data: {
          settlementId: created.id,
          kind: "ADVANCE",
          label: `${advance.advanceType} advance`,
          amountCents: -advance.remainingCents,
          advanceId: advance.id,
          sortOrder: sortOrder++
        }
      });
      await tx.advanceApplication.create({
        data: {
          advanceId: advance.id,
          amountCents: advance.remainingCents,
          driverSettlementId: created.id
        }
      });
      await tx.advance.update({
        where: { id: advance.id },
        data: { status: "APPLIED" }
      });
    }

    return created;
  });

  revalidatePath("/fleet/settlements");
  revalidatePath("/fleet/advances");
  redirect(`/fleet/settlements?saved=1&highlight=${settlement.id}`);
}

export async function updateDriverSettlementStatus(formData: FormData) {
  const user = await requireWriteUser();
  await assertPlanFeature(user.companyId, "fleet_dispatch");
  const settlementId = requiredString(formData, "settlementId");
  const status = requiredString(formData, "status");
  if (!["DRAFT", "APPROVED", "PAID", "VOID"].includes(status)) {
    throw new Error("Invalid status");
  }

  const existing = await prisma.driverSettlement.findFirst({
    where: { id: settlementId, companyId: user.companyId },
    include: {
      advanceApplications: true,
      payLines: true
    }
  });
  if (!existing) throw new Error("Settlement not found");

  if (status === "VOID" && existing.status === "PAID") {
    throw new Error("Paid settlements cannot be voided");
  }

  await prisma.$transaction(async (tx) => {
    if (status === "VOID") {
      for (const line of existing.payLines) {
        await tx.driverPayLine.update({
          where: { id: line.id },
          data: { settlementId: null, settledAt: null }
        });
      }
      const advanceIds = [
        ...new Set(existing.advanceApplications.map((app) => app.advanceId))
      ];
      await tx.advanceApplication.deleteMany({ where: { driverSettlementId: settlementId } });
      await tx.driverSettlementItem.deleteMany({ where: { settlementId } });
      for (const advanceId of advanceIds) {
        const advance = await tx.advance.findUnique({
          where: { id: advanceId },
          include: { applications: true }
        });
        if (!advance || advance.status === "VOID") continue;
        const applied = advance.applications.reduce((sum, row) => sum + row.amountCents, 0);
        await tx.advance.update({
          where: { id: advanceId },
          data: { status: applied >= advance.amountCents ? "APPLIED" : "OPEN" }
        });
      }
    }

    if (status === "PAID" && existing.status !== "PAID") {
      const payAmount = Math.max(0, existing.netCents);
      if (payAmount > 0) {
        await tx.payment.create({
          data: {
            companyId: user.companyId,
            direction: "AP",
            amountCents: payAmount,
            paidAt: new Date(),
            method: optionalString(formData, "method") ?? "CHECK",
            reference: optionalString(formData, "reference"),
            notes: `Driver settlement ${settlementId}`,
            driverId: existing.driverId,
            createdByUserId: user.id,
            applications: {
              create: [
                {
                  driverSettlementId: settlementId,
                  amountCents: payAmount
                }
              ]
            }
          }
        });
      }
    }

    await tx.driverSettlement.update({
      where: { id: settlementId },
      data: {
        status,
        paidAt: status === "PAID" ? new Date() : existing.paidAt
      }
    });
  });

  revalidatePath("/fleet/settlements");
  revalidatePath("/fleet/advances");
  revalidatePath("/accounting");
  redirect("/fleet/settlements?saved=1");
}

export async function updateDriverCsaScores(formData: FormData) {
  const user = await requireWriteUser();
  await assertPlanFeature(user.companyId, "fleet_assets");
  const driverId = requiredString(formData, "driverId");
  const driver = await prisma.driver.findFirst({
    where: { id: driverId, companyId: user.companyId }
  });
  if (!driver) throw new Error("Driver not found");

  function score(key: string) {
    const raw = String(formData.get(key) ?? "").trim();
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  await prisma.driver.update({
    where: { id: driverId },
    data: {
      csaUnsafeDriving: score("csaUnsafeDriving"),
      csaHosCompliance: score("csaHosCompliance"),
      csaVehicleMaint: score("csaVehicleMaint"),
      csaControlledSub: score("csaControlledSub"),
      csaDriverFitness: score("csaDriverFitness"),
      csaCrashIndicator: score("csaCrashIndicator"),
      hosStatusSummary: optionalString(formData, "hosStatusSummary") ?? null
    }
  });

  revalidatePath(`/fleet/drivers/${driverId}`);
  redirect(`/fleet/drivers/${driverId}?saved=1`);
}
