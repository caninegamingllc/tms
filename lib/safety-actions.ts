"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { SAFETY_EVENT_TYPES } from "@/lib/fleet-constants";
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

export async function createSafetyEvent(formData: FormData) {
  const user = await requireWriteUser();
  await assertPlanFeature(user.companyId, "safety_records");

  const eventType = optionalString(formData, "eventType") ?? "ACCIDENT";
  if (!(SAFETY_EVENT_TYPES as readonly string[]).includes(eventType)) {
    throw new Error("Invalid event type");
  }

  const driverId = optionalString(formData, "driverId") ?? null;
  const truckId = optionalString(formData, "truckId") ?? null;
  const trailerId = optionalString(formData, "trailerId") ?? null;
  const loadId = optionalString(formData, "loadId") ?? null;

  if (driverId) {
    const ok = await prisma.driver.findFirst({
      where: { id: driverId, companyId: user.companyId },
      select: { id: true }
    });
    if (!ok) throw new Error("Driver not found");
  }
  if (truckId) {
    const ok = await prisma.truck.findFirst({
      where: { id: truckId, companyId: user.companyId },
      select: { id: true }
    });
    if (!ok) throw new Error("Truck not found");
  }
  if (trailerId) {
    const ok = await prisma.trailer.findFirst({
      where: { id: trailerId, companyId: user.companyId },
      select: { id: true }
    });
    if (!ok) throw new Error("Trailer not found");
  }
  if (loadId) {
    const ok = await prisma.load.findFirst({
      where: { id: loadId, companyId: user.companyId },
      select: { id: true }
    });
    if (!ok) throw new Error("Load not found");
  }

  await prisma.safetyEvent.create({
    data: {
      companyId: user.companyId,
      driverId,
      truckId,
      trailerId,
      loadId,
      eventType,
      occurredAt: optionalDate(formData, "occurredAt") ?? new Date(),
      severity: optionalString(formData, "severity") ?? null,
      location: optionalString(formData, "location") ?? null,
      description: requiredString(formData, "description"),
      dotRecordable: String(formData.get("dotRecordable") ?? "") === "on",
      claimNumber: optionalString(formData, "claimNumber") ?? null,
      resolutionNotes: optionalString(formData, "resolutionNotes") ?? null
    }
  });

  revalidatePath("/fleet/safety");
  redirect("/fleet/safety?saved=1");
}

export async function updateSafetyEvent(formData: FormData) {
  const user = await requireWriteUser();
  await assertPlanFeature(user.companyId, "safety_records");

  const eventId = requiredString(formData, "eventId");
  const existing = await prisma.safetyEvent.findFirst({
    where: { id: eventId, companyId: user.companyId }
  });
  if (!existing) throw new Error("Safety event not found");

  const eventType = optionalString(formData, "eventType") ?? existing.eventType;
  if (!(SAFETY_EVENT_TYPES as readonly string[]).includes(eventType)) {
    throw new Error("Invalid event type");
  }

  await prisma.safetyEvent.update({
    where: { id: eventId },
    data: {
      eventType,
      occurredAt: optionalDate(formData, "occurredAt") ?? existing.occurredAt,
      severity: optionalString(formData, "severity") ?? null,
      location: optionalString(formData, "location") ?? null,
      description: requiredString(formData, "description"),
      dotRecordable: String(formData.get("dotRecordable") ?? "") === "on",
      claimNumber: optionalString(formData, "claimNumber") ?? null,
      resolutionNotes: optionalString(formData, "resolutionNotes") ?? null,
      driverId: optionalString(formData, "driverId") ?? null,
      truckId: optionalString(formData, "truckId") ?? null,
      trailerId: optionalString(formData, "trailerId") ?? null,
      loadId: optionalString(formData, "loadId") ?? null
    }
  });

  revalidatePath("/fleet/safety");
  redirect("/fleet/safety?saved=1");
}
