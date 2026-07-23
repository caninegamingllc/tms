"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { parseMoneyToCents } from "@/lib/format";
import { assertPlanFeature, requireWriteUser } from "@/lib/permissions";
import {
  ASSET_STATUSES,
  DRIVER_STATUSES,
  MAINTENANCE_WORK_TYPES,
  TRUCK_OWNERSHIPS
} from "@/lib/fleet-constants";
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

function parseStatus(value: string | undefined, allowed: readonly string[], fallback: string) {
  if (value && allowed.includes(value)) return value;
  return fallback;
}

async function requireCompanyDriver(driverId: string, companyId: string) {
  const driver = await prisma.driver.findFirst({ where: { id: driverId, companyId } });
  if (!driver) throw new Error("Driver not found");
  return driver;
}

async function requireCompanyTruck(truckId: string, companyId: string) {
  const truck = await prisma.truck.findFirst({ where: { id: truckId, companyId } });
  if (!truck) throw new Error("Truck not found");
  return truck;
}

async function requireCompanyTrailer(trailerId: string, companyId: string) {
  const trailer = await prisma.trailer.findFirst({ where: { id: trailerId, companyId } });
  if (!trailer) throw new Error("Trailer not found");
  return trailer;
}

export async function createDriver(formData: FormData) {
  const user = await requireWriteUser();
  await assertPlanFeature(user.companyId, "fleet_assets");

  const firstName = requiredString(formData, "firstName");
  const lastName = requiredString(formData, "lastName");
  const employeeNumber = optionalString(formData, "employeeNumber") ?? null;

  const driver = await prisma.driver.create({
    data: {
      companyId: user.companyId,
      firstName,
      lastName,
      phone: optionalString(formData, "phone") ?? null,
      email: optionalString(formData, "email") ?? null,
      employeeNumber,
      status: parseStatus(optionalString(formData, "status"), DRIVER_STATUSES, "ACTIVE"),
      hireDate: optionalDate(formData, "hireDate"),
      terminationDate: optionalDate(formData, "terminationDate"),
      dateOfBirth: optionalDate(formData, "dateOfBirth"),
      cdlNumber: optionalString(formData, "cdlNumber") ?? null,
      cdlClass: optionalString(formData, "cdlClass") ?? null,
      cdlState: optionalString(formData, "cdlState") ?? null,
      cdlEndorsements: optionalString(formData, "cdlEndorsements") ?? null,
      cdlExpiresAt: optionalDate(formData, "cdlExpiresAt"),
      medicalExpiresAt: optionalDate(formData, "medicalExpiresAt"),
      notes: optionalString(formData, "notes") ?? null
    }
  });

  revalidatePath("/fleet/drivers");
  revalidatePath("/fleet/compliance");
  redirect(`/fleet/drivers/${driver.id}?saved=1`);
}

export async function updateDriver(formData: FormData) {
  const user = await requireWriteUser();
  await assertPlanFeature(user.companyId, "fleet_assets");
  const driverId = requiredString(formData, "driverId");
  await requireCompanyDriver(driverId, user.companyId);

  await prisma.driver.update({
    where: { id: driverId },
    data: {
      firstName: requiredString(formData, "firstName"),
      lastName: requiredString(formData, "lastName"),
      phone: optionalString(formData, "phone") ?? null,
      email: optionalString(formData, "email") ?? null,
      employeeNumber: optionalString(formData, "employeeNumber") ?? null,
      status: parseStatus(optionalString(formData, "status"), DRIVER_STATUSES, "ACTIVE"),
      hireDate: optionalDate(formData, "hireDate"),
      terminationDate: optionalDate(formData, "terminationDate"),
      dateOfBirth: optionalDate(formData, "dateOfBirth"),
      cdlNumber: optionalString(formData, "cdlNumber") ?? null,
      cdlClass: optionalString(formData, "cdlClass") ?? null,
      cdlState: optionalString(formData, "cdlState") ?? null,
      cdlEndorsements: optionalString(formData, "cdlEndorsements") ?? null,
      cdlExpiresAt: optionalDate(formData, "cdlExpiresAt"),
      medicalExpiresAt: optionalDate(formData, "medicalExpiresAt"),
      notes: optionalString(formData, "notes") ?? null
    }
  });

  revalidatePath("/fleet/drivers");
  revalidatePath(`/fleet/drivers/${driverId}`);
  revalidatePath("/fleet/compliance");
  redirect(`/fleet/drivers/${driverId}?saved=1`);
}

export async function createTruck(formData: FormData) {
  const user = await requireWriteUser();
  await assertPlanFeature(user.companyId, "fleet_assets");

  const truck = await prisma.truck.create({
    data: {
      companyId: user.companyId,
      unitNumber: requiredString(formData, "unitNumber"),
      year: optionalInt(formData, "year"),
      make: optionalString(formData, "make") ?? null,
      model: optionalString(formData, "model") ?? null,
      vin: optionalString(formData, "vin") ?? null,
      licensePlate: optionalString(formData, "licensePlate") ?? null,
      licenseState: optionalString(formData, "licenseState") ?? null,
      status: parseStatus(optionalString(formData, "status"), ASSET_STATUSES, "ACTIVE"),
      ownership: parseStatus(optionalString(formData, "ownership"), TRUCK_OWNERSHIPS, "COMPANY"),
      registrationExpiresAt: optionalDate(formData, "registrationExpiresAt"),
      annualInspectionExpiresAt: optionalDate(formData, "annualInspectionExpiresAt"),
      irpExpiresAt: optionalDate(formData, "irpExpiresAt"),
      insuranceExpiresAt: optionalDate(formData, "insuranceExpiresAt"),
      notes: optionalString(formData, "notes") ?? null
    }
  });

  revalidatePath("/fleet/trucks");
  revalidatePath("/fleet/compliance");
  redirect(`/fleet/trucks/${truck.id}?saved=1`);
}

export async function updateTruck(formData: FormData) {
  const user = await requireWriteUser();
  await assertPlanFeature(user.companyId, "fleet_assets");
  const truckId = requiredString(formData, "truckId");
  await requireCompanyTruck(truckId, user.companyId);

  await prisma.truck.update({
    where: { id: truckId },
    data: {
      unitNumber: requiredString(formData, "unitNumber"),
      year: optionalInt(formData, "year"),
      make: optionalString(formData, "make") ?? null,
      model: optionalString(formData, "model") ?? null,
      vin: optionalString(formData, "vin") ?? null,
      licensePlate: optionalString(formData, "licensePlate") ?? null,
      licenseState: optionalString(formData, "licenseState") ?? null,
      status: parseStatus(optionalString(formData, "status"), ASSET_STATUSES, "ACTIVE"),
      ownership: parseStatus(optionalString(formData, "ownership"), TRUCK_OWNERSHIPS, "COMPANY"),
      registrationExpiresAt: optionalDate(formData, "registrationExpiresAt"),
      annualInspectionExpiresAt: optionalDate(formData, "annualInspectionExpiresAt"),
      irpExpiresAt: optionalDate(formData, "irpExpiresAt"),
      insuranceExpiresAt: optionalDate(formData, "insuranceExpiresAt"),
      notes: optionalString(formData, "notes") ?? null
    }
  });

  revalidatePath("/fleet/trucks");
  revalidatePath(`/fleet/trucks/${truckId}`);
  revalidatePath("/fleet/compliance");
  redirect(`/fleet/trucks/${truckId}?saved=1`);
}

export async function createTrailer(formData: FormData) {
  const user = await requireWriteUser();
  await assertPlanFeature(user.companyId, "fleet_assets");

  const trailer = await prisma.trailer.create({
    data: {
      companyId: user.companyId,
      unitNumber: requiredString(formData, "unitNumber"),
      year: optionalInt(formData, "year"),
      make: optionalString(formData, "make") ?? null,
      model: optionalString(formData, "model") ?? null,
      vin: optionalString(formData, "vin") ?? null,
      licensePlate: optionalString(formData, "licensePlate") ?? null,
      licenseState: optionalString(formData, "licenseState") ?? null,
      trailerType: optionalString(formData, "trailerType") ?? "Dry Van",
      status: parseStatus(optionalString(formData, "status"), ASSET_STATUSES, "ACTIVE"),
      registrationExpiresAt: optionalDate(formData, "registrationExpiresAt"),
      annualInspectionExpiresAt: optionalDate(formData, "annualInspectionExpiresAt"),
      insuranceExpiresAt: optionalDate(formData, "insuranceExpiresAt"),
      notes: optionalString(formData, "notes") ?? null
    }
  });

  revalidatePath("/fleet/trailers");
  revalidatePath("/fleet/compliance");
  redirect(`/fleet/trailers/${trailer.id}?saved=1`);
}

export async function updateTrailer(formData: FormData) {
  const user = await requireWriteUser();
  await assertPlanFeature(user.companyId, "fleet_assets");
  const trailerId = requiredString(formData, "trailerId");
  await requireCompanyTrailer(trailerId, user.companyId);

  await prisma.trailer.update({
    where: { id: trailerId },
    data: {
      unitNumber: requiredString(formData, "unitNumber"),
      year: optionalInt(formData, "year"),
      make: optionalString(formData, "make") ?? null,
      model: optionalString(formData, "model") ?? null,
      vin: optionalString(formData, "vin") ?? null,
      licensePlate: optionalString(formData, "licensePlate") ?? null,
      licenseState: optionalString(formData, "licenseState") ?? null,
      trailerType: optionalString(formData, "trailerType") ?? "Dry Van",
      status: parseStatus(optionalString(formData, "status"), ASSET_STATUSES, "ACTIVE"),
      registrationExpiresAt: optionalDate(formData, "registrationExpiresAt"),
      annualInspectionExpiresAt: optionalDate(formData, "annualInspectionExpiresAt"),
      insuranceExpiresAt: optionalDate(formData, "insuranceExpiresAt"),
      notes: optionalString(formData, "notes") ?? null
    }
  });

  revalidatePath("/fleet/trailers");
  revalidatePath(`/fleet/trailers/${trailerId}`);
  revalidatePath("/fleet/compliance");
  redirect(`/fleet/trailers/${trailerId}?saved=1`);
}

export async function addMaintenanceLog(formData: FormData) {
  const user = await requireWriteUser();
  await assertPlanFeature(user.companyId, "fleet_assets");

  const assetType = requiredString(formData, "assetType").toUpperCase();
  const assetId = requiredString(formData, "assetId");
  if (assetType !== "TRUCK" && assetType !== "TRAILER") {
    throw new Error("Invalid asset type");
  }

  if (assetType === "TRUCK") {
    await requireCompanyTruck(assetId, user.companyId);
  } else {
    await requireCompanyTrailer(assetId, user.companyId);
  }

  await prisma.equipmentMaintenanceLog.create({
    data: {
      companyId: user.companyId,
      assetType,
      assetId,
      performedAt: optionalDate(formData, "performedAt") ?? new Date(),
      workType: parseStatus(optionalString(formData, "workType"), MAINTENANCE_WORK_TYPES, "PM"),
      odometer: optionalInt(formData, "odometer"),
      costCents: parseMoneyToCents(formData.get("cost")),
      vendor: optionalString(formData, "vendor") ?? null,
      notes: optionalString(formData, "notes") ?? null
    }
  });

  const base = assetType === "TRUCK" ? `/fleet/trucks/${assetId}` : `/fleet/trailers/${assetId}`;
  revalidatePath(base);
  redirect(`${base}?saved=1`);
}

export async function assignFleetToLoad(formData: FormData) {
  const user = await requireWriteUser();
  await assertPlanFeature(user.companyId, "fleet_dispatch");

  const loadId = requiredString(formData, "loadId");
  const load = await prisma.load.findFirst({
    where: { id: loadId, companyId: user.companyId },
    include: { dispatchAssignments: { orderBy: { sequence: "asc" } } }
  });
  if (!load) throw new Error("Load not found");

  if (["INVOICED", "PAID"].includes(load.status)) {
    redirect(
      `/loads/${loadId}?error=${encodeURIComponent("Cannot change fleet assignment on an invoiced or paid load.")}`
    );
  }

  const driverId = optionalString(formData, "driverId") ?? null;
  const truckId = optionalString(formData, "truckId") ?? null;
  const trailerId = optionalString(formData, "trailerId") ?? null;

  if (!driverId && !truckId && !trailerId) {
    redirect(
      `/loads/${loadId}?error=${encodeURIComponent("Select at least a driver, tractor, or trailer.")}`
    );
  }

  let driverName: string | null = null;
  let driverPhone: string | null = null;
  let truckNumber: string | null = null;
  let trailerNumber: string | null = null;

  if (driverId) {
    const driver = await requireCompanyDriver(driverId, user.companyId);
    driverName = `${driver.firstName} ${driver.lastName}`.trim();
    driverPhone = driver.phone;
  }
  if (truckId) {
    const truck = await requireCompanyTruck(truckId, user.companyId);
    truckNumber = truck.unitNumber;
  }
  if (trailerId) {
    const trailer = await requireCompanyTrailer(trailerId, user.companyId);
    trailerNumber = trailer.unitNumber;
  }

  const nextStatus =
    load.status === "AVAILABLE" || load.status === "QUOTE" ? "COVERED" : load.status;

  const primary =
    load.dispatchAssignments.find((row) => row.sequence === 0) ??
    load.dispatchAssignments[0] ??
    null;

  await prisma.$transaction(async (tx) => {
    if (primary) {
      await tx.dispatchAssignment.update({
        where: { id: primary.id },
        data: {
          driverId,
          truckId,
          trailerId,
          driverName,
          driverPhone,
          truckNumber,
          trailerNumber
        }
      });
    } else {
      await tx.dispatchAssignment.create({
        data: {
          loadId,
          sequence: 0,
          carrierId: null,
          driverId,
          truckId,
          trailerId,
          driverName,
          driverPhone,
          truckNumber,
          trailerNumber,
          rateCents: 0
        }
      });
    }

    await tx.load.update({
      where: { id: loadId },
      data: {
        status: nextStatus,
        activities: {
          create: {
            userId: user.id,
            action: "Fleet assigned",
            details: [
              driverName ? `Driver ${driverName}` : null,
              truckNumber ? `Tractor ${truckNumber}` : null,
              trailerNumber ? `Trailer ${trailerNumber}` : null
            ]
              .filter(Boolean)
              .join(", ")
          }
        }
      }
    });
  });

  revalidatePath("/dispatch");
  revalidatePath("/loads");
  revalidatePath(`/loads/${loadId}`);
  redirect(`/loads/${loadId}?saved=1`);
}

export async function clearFleetAssignment(formData: FormData) {
  const user = await requireWriteUser();
  await assertPlanFeature(user.companyId, "fleet_dispatch");

  const loadId = requiredString(formData, "loadId");
  const load = await prisma.load.findFirst({
    where: { id: loadId, companyId: user.companyId },
    include: { dispatchAssignments: { orderBy: { sequence: "asc" } } }
  });
  const primary =
    load?.dispatchAssignments.find((row) => row.sequence === 0) ??
    load?.dispatchAssignments[0] ??
    null;
  if (!load || !primary) {
    redirect(`/loads/${loadId}?error=${encodeURIComponent("No assignment on this load.")}`);
  }

  if (["INVOICED", "PAID"].includes(load.status)) {
    redirect(
      `/loads/${loadId}?error=${encodeURIComponent("Cannot clear fleet on an invoiced or paid load.")}`
    );
  }

  const hasCarrier = Boolean(primary.carrierId);
  const hasOtherAssignments = load.dispatchAssignments.some((row) => row.id !== primary.id);

  await prisma.$transaction(async (tx) => {
    if (hasCarrier || hasOtherAssignments) {
      await tx.dispatchAssignment.update({
        where: { id: primary.id },
        data: {
          driverId: null,
          truckId: null,
          trailerId: null,
          driverName: null,
          driverPhone: null,
          truckNumber: null,
          trailerNumber: null
        }
      });
    } else {
      await tx.dispatchAssignment.delete({ where: { id: primary.id } });
      const nextStatus =
        load.status === "COVERED" || load.status === "DISPATCHED" ? "AVAILABLE" : load.status;
      await tx.load.update({
        where: { id: loadId },
        data: {
          status: nextStatus,
          activities: {
            create: {
              userId: user.id,
              action: "Fleet unassigned",
              details: "Own-fleet assignment removed."
            }
          }
        }
      });
    }
  });

  revalidatePath("/dispatch");
  revalidatePath("/loads");
  revalidatePath(`/loads/${loadId}`);
  redirect(`/loads/${loadId}?saved=1`);
}
