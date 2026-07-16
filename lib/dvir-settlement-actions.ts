"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { assertPlanFeature, requireWriteUser } from "@/lib/permissions";

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
  return value ? new Date(value) : null;
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

  const loadId = optionalString(formData, "loadId") ?? null;
  if (loadId) {
    const load = await prisma.load.findFirst({
      where: { id: loadId, companyId: user.companyId }
    });
    if (!load) throw new Error("Load not found");
  }

  const payMethod = optionalString(formData, "payMethod") ?? "FLAT";
  const miles = Number(String(formData.get("miles") ?? "0"));
  const revenueCents = Math.round(Number(String(formData.get("revenue") ?? "0").replace(/[^0-9.-]/g, "")) * 100);
  const payCents = Math.round(Number(String(formData.get("pay") ?? "0").replace(/[^0-9.-]/g, "")) * 100);
  const deductionsCents = Math.round(
    Number(String(formData.get("deductions") ?? "0").replace(/[^0-9.-]/g, "")) * 100
  );
  const netCents = payCents - deductionsCents;

  await prisma.driverSettlement.create({
    data: {
      companyId: user.companyId,
      driverId,
      loadId,
      periodStart: optionalDate(formData, "periodStart"),
      periodEnd: optionalDate(formData, "periodEnd"),
      payMethod,
      miles: Number.isFinite(miles) ? miles : 0,
      revenueCents: Number.isFinite(revenueCents) ? revenueCents : 0,
      payCents: Number.isFinite(payCents) ? payCents : 0,
      deductionsCents: Number.isFinite(deductionsCents) ? deductionsCents : 0,
      netCents: Number.isFinite(netCents) ? netCents : 0,
      status: "DRAFT",
      notes: optionalString(formData, "notes") ?? null
    }
  });

  revalidatePath("/fleet/settlements");
  redirect("/fleet/settlements?saved=1");
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
    where: { id: settlementId, companyId: user.companyId }
  });
  if (!existing) throw new Error("Settlement not found");

  await prisma.driverSettlement.update({
    where: { id: settlementId },
    data: {
      status,
      paidAt: status === "PAID" ? new Date() : existing.paidAt
    }
  });

  revalidatePath("/fleet/settlements");
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
