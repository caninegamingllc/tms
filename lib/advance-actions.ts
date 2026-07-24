"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { advancePayeeTypes, advanceTypes } from "@/lib/constants";
import { parseLocalDateTime } from "@/lib/dates";
import { parseMoneyToCents } from "@/lib/format";
import { assertPlanFeature, requireWriteUser } from "@/lib/permissions";
import { advanceRemainingCents } from "@/lib/driver-pay";

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

export async function createAdvance(formData: FormData) {
  const user = await requireWriteUser();
  await assertPlanFeature(user.companyId, "fleet_dispatch");

  const payeeType = requiredString(formData, "payeeType");
  if (!(advancePayeeTypes as readonly string[]).includes(payeeType)) {
    throw new Error("Invalid payee type");
  }

  const advanceTypeRaw = optionalString(formData, "advanceType") ?? "CASH";
  const advanceType = (advanceTypes as readonly string[]).includes(advanceTypeRaw)
    ? advanceTypeRaw
    : "CASH";

  const amountCents = parseMoneyToCents(formData.get("amount"));
  if (amountCents <= 0) {
    throw new Error("Advance amount must be greater than zero");
  }

  const driverId = optionalString(formData, "driverId") ?? null;
  const carrierId = optionalString(formData, "carrierId") ?? null;
  const loadId = optionalString(formData, "loadId") ?? null;

  if (payeeType === "DRIVER") {
    if (!driverId) throw new Error("Driver is required");
    const driver = await prisma.driver.findFirst({
      where: { id: driverId, companyId: user.companyId }
    });
    if (!driver) throw new Error("Driver not found");
  } else {
    if (!carrierId) throw new Error("Carrier is required");
    const carrier = await prisma.carrier.findFirst({
      where: { id: carrierId, companyId: user.companyId }
    });
    if (!carrier) throw new Error("Carrier not found");
  }

  if (loadId) {
    const load = await prisma.load.findFirst({
      where: { id: loadId, companyId: user.companyId }
    });
    if (!load) throw new Error("Load not found");
  }

  await prisma.advance.create({
    data: {
      companyId: user.companyId,
      payeeType,
      driverId: payeeType === "DRIVER" ? driverId : null,
      carrierId: payeeType === "CARRIER" ? carrierId : null,
      advanceType,
      amountCents,
      issuedAt: optionalDate(formData, "issuedAt") ?? new Date(),
      loadId,
      status: "OPEN",
      notes: optionalString(formData, "notes") ?? null,
      reference: optionalString(formData, "reference") ?? null
    }
  });

  revalidatePath("/fleet/advances");
  revalidatePath("/fleet/settlements");
  revalidatePath("/accounting");
  redirect("/fleet/advances?saved=1");
}

export async function voidAdvance(formData: FormData) {
  const user = await requireWriteUser();
  await assertPlanFeature(user.companyId, "fleet_dispatch");

  const id = requiredString(formData, "advanceId");
  const advance = await prisma.advance.findFirst({
    where: { id, companyId: user.companyId },
    include: { applications: true }
  });
  if (!advance) throw new Error("Advance not found");
  if (advance.applications.length > 0) {
    throw new Error("Cannot void an advance that has already been applied");
  }

  await prisma.advance.update({
    where: { id },
    data: { status: "VOID" }
  });

  revalidatePath("/fleet/advances");
  redirect("/fleet/advances?saved=1");
}

export async function getOpenAdvancesForCarrier(companyId: string, carrierId: string) {
  const advances = await prisma.advance.findMany({
    where: {
      companyId,
      carrierId,
      payeeType: "CARRIER",
      status: "OPEN"
    },
    include: { applications: true },
    orderBy: { issuedAt: "asc" }
  });

  return advances
    .map((advance) => ({
      ...advance,
      remainingCents: advanceRemainingCents(advance)
    }))
    .filter((advance) => advance.remainingCents > 0);
}

export async function getOpenAdvancesForDriver(companyId: string, driverId: string) {
  const advances = await prisma.advance.findMany({
    where: {
      companyId,
      driverId,
      payeeType: "DRIVER",
      status: "OPEN"
    },
    include: { applications: true },
    orderBy: { issuedAt: "asc" }
  });

  return advances
    .map((advance) => ({
      ...advance,
      remainingCents: advanceRemainingCents(advance)
    }))
    .filter((advance) => advance.remainingCents > 0);
}
