"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { primaryAssignment } from "@/lib/dispatch-assignment";
import { parseMoneyToCents } from "@/lib/format";
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

function requiredFloat(formData: FormData, key: string) {
  const n = Number(String(formData.get(key) ?? "").trim());
  if (!Number.isFinite(n)) throw new Error(`${key} must be a number`);
  return n;
}

async function requireQuarter(quarterId: string, companyId: string) {
  const quarter = await prisma.iftaQuarter.findFirst({
    where: { id: quarterId, companyId }
  });
  if (!quarter) throw new Error("IFTA quarter not found");
  return quarter;
}

export async function createIftaQuarter(formData: FormData) {
  const user = await requireWriteUser();
  await assertPlanFeature(user.companyId, "fuel_tax_ifta");

  const year = Number(requiredString(formData, "year"));
  const quarter = Number(requiredString(formData, "quarter"));
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error("Invalid year");
  }
  if (![1, 2, 3, 4].includes(quarter)) {
    throw new Error("Quarter must be 1–4");
  }

  const created = await prisma.iftaQuarter.create({
    data: {
      companyId: user.companyId,
      year,
      quarter,
      status: "OPEN",
      notes: optionalString(formData, "notes") ?? null
    }
  });

  revalidatePath("/fleet/fuel-tax");
  redirect(`/fleet/fuel-tax/${created.id}`);
}

export async function updateIftaQuarterStatus(formData: FormData) {
  const user = await requireWriteUser();
  await assertPlanFeature(user.companyId, "fuel_tax_ifta");
  const quarterId = requiredString(formData, "quarterId");
  await requireQuarter(quarterId, user.companyId);
  const status = requiredString(formData, "status");
  if (!["OPEN", "IN_PROGRESS", "FILED"].includes(status)) {
    throw new Error("Invalid status");
  }

  await prisma.iftaQuarter.update({
    where: { id: quarterId },
    data: {
      status,
      filedAt: status === "FILED" ? new Date() : null,
      notes: optionalString(formData, "notes") ?? undefined
    }
  });

  revalidatePath("/fleet/fuel-tax");
  revalidatePath(`/fleet/fuel-tax/${quarterId}`);
  redirect(`/fleet/fuel-tax/${quarterId}?saved=1`);
}

export async function addIftaTrip(formData: FormData) {
  const user = await requireWriteUser();
  await assertPlanFeature(user.companyId, "fuel_tax_ifta");
  const quarterId = requiredString(formData, "quarterId");
  const quarter = await requireQuarter(quarterId, user.companyId);
  if (quarter.status === "FILED") {
    throw new Error("Cannot edit a filed quarter");
  }

  const truckId = optionalString(formData, "truckId") ?? null;
  const driverId = optionalString(formData, "driverId") ?? null;
  if (truckId) {
    const ok = await prisma.truck.findFirst({
      where: { id: truckId, companyId: user.companyId },
      select: { id: true }
    });
    if (!ok) throw new Error("Truck not found");
  }
  if (driverId) {
    const ok = await prisma.driver.findFirst({
      where: { id: driverId, companyId: user.companyId },
      select: { id: true }
    });
    if (!ok) throw new Error("Driver not found");
  }

  await prisma.iftaTrip.create({
    data: {
      quarterId,
      truckId,
      driverId,
      loadId: optionalString(formData, "loadId") ?? null,
      startAt: optionalDate(formData, "startAt") ?? new Date(),
      endAt: optionalDate(formData, "endAt"),
      jurisdiction: requiredString(formData, "jurisdiction").toUpperCase(),
      miles: Math.max(0, requiredFloat(formData, "miles")),
      notes: optionalString(formData, "notes") ?? null
    }
  });

  if (quarter.status === "OPEN") {
    await prisma.iftaQuarter.update({
      where: { id: quarterId },
      data: { status: "IN_PROGRESS" }
    });
  }

  revalidatePath(`/fleet/fuel-tax/${quarterId}`);
  redirect(`/fleet/fuel-tax/${quarterId}?saved=1`);
}

export async function deleteIftaTrip(formData: FormData) {
  const user = await requireWriteUser();
  await assertPlanFeature(user.companyId, "fuel_tax_ifta");
  const tripId = requiredString(formData, "tripId");
  const quarterId = requiredString(formData, "quarterId");
  await requireQuarter(quarterId, user.companyId);

  await prisma.iftaTrip.deleteMany({
    where: { id: tripId, quarterId }
  });

  revalidatePath(`/fleet/fuel-tax/${quarterId}`);
  redirect(`/fleet/fuel-tax/${quarterId}?saved=1`);
}

export async function addIftaFuelPurchase(formData: FormData) {
  const user = await requireWriteUser();
  await assertPlanFeature(user.companyId, "fuel_tax_ifta");
  const quarterId = requiredString(formData, "quarterId");
  const quarter = await requireQuarter(quarterId, user.companyId);
  if (quarter.status === "FILED") {
    throw new Error("Cannot edit a filed quarter");
  }

  await prisma.iftaFuelPurchase.create({
    data: {
      quarterId,
      purchasedAt: optionalDate(formData, "purchasedAt") ?? new Date(),
      jurisdiction: requiredString(formData, "jurisdiction").toUpperCase(),
      gallons: Math.max(0, requiredFloat(formData, "gallons")),
      costCents: parseMoneyToCents(formData.get("cost")),
      vendor: optionalString(formData, "vendor") ?? null,
      truckId: optionalString(formData, "truckId") ?? null,
      notes: optionalString(formData, "notes") ?? null
    }
  });

  if (quarter.status === "OPEN") {
    await prisma.iftaQuarter.update({
      where: { id: quarterId },
      data: { status: "IN_PROGRESS" }
    });
  }

  revalidatePath(`/fleet/fuel-tax/${quarterId}`);
  redirect(`/fleet/fuel-tax/${quarterId}?saved=1`);
}

export async function deleteIftaFuelPurchase(formData: FormData) {
  const user = await requireWriteUser();
  await assertPlanFeature(user.companyId, "fuel_tax_ifta");
  const purchaseId = requiredString(formData, "purchaseId");
  const quarterId = requiredString(formData, "quarterId");
  await requireQuarter(quarterId, user.companyId);

  await prisma.iftaFuelPurchase.deleteMany({
    where: { id: purchaseId, quarterId }
  });

  revalidatePath(`/fleet/fuel-tax/${quarterId}`);
  redirect(`/fleet/fuel-tax/${quarterId}?saved=1`);
}

/** Import jurisdiction miles from a delivered load's routeStateMiles JSON onto the quarter. */
export async function importLoadMilesToIfta(formData: FormData) {
  const user = await requireWriteUser();
  await assertPlanFeature(user.companyId, "fuel_tax_ifta");
  const quarterId = requiredString(formData, "quarterId");
  const loadId = requiredString(formData, "loadId");
  const quarter = await requireQuarter(quarterId, user.companyId);
  if (quarter.status === "FILED") {
    throw new Error("Cannot edit a filed quarter");
  }

  const load = await prisma.load.findFirst({
    where: { id: loadId, companyId: user.companyId },
    include: { dispatchAssignments: { orderBy: { sequence: "asc" } } }
  });
  if (!load) throw new Error("Load not found");

  const stateMiles = load.routeStateMiles;
  if (!stateMiles || typeof stateMiles !== "object" || Array.isArray(stateMiles)) {
    throw new Error("Load has no state mileage breakdown. Compute the route first.");
  }

  const entries = Object.entries(stateMiles as Record<string, unknown>).filter(
    ([, miles]) => typeof miles === "number" && miles > 0
  );
  if (entries.length === 0) {
    throw new Error("No positive jurisdiction miles on this load.");
  }

  const primary = primaryAssignment(load.dispatchAssignments);

  await prisma.iftaTrip.createMany({
    data: entries.map(([jurisdiction, miles]) => ({
      quarterId,
      loadId: load.id,
      truckId: primary?.truckId ?? null,
      driverId: primary?.driverId ?? null,
      startAt: load.pickupDate,
      endAt: load.deliveryDate,
      jurisdiction: jurisdiction.toUpperCase(),
      miles: Number(miles),
      notes: `Imported from load ${load.loadNumber}`
    }))
  });

  if (quarter.status === "OPEN") {
    await prisma.iftaQuarter.update({
      where: { id: quarterId },
      data: { status: "IN_PROGRESS" }
    });
  }

  revalidatePath(`/fleet/fuel-tax/${quarterId}`);
  redirect(`/fleet/fuel-tax/${quarterId}?saved=1`);
}
