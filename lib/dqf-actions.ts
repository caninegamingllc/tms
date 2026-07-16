"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { DQF_CATEGORIES } from "@/lib/fleet-constants";
import { deleteStoredFile, saveUploadedFile } from "@/lib/document-storage";
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

function resolveDqfStatus(expiresAt: Date | null, hasFile: boolean): string {
  if (expiresAt && expiresAt.getTime() < Date.now()) return "EXPIRED";
  if (hasFile || expiresAt) return "CURRENT";
  return "PENDING";
}

async function requireCompanyDriver(driverId: string, companyId: string) {
  const driver = await prisma.driver.findFirst({ where: { id: driverId, companyId } });
  if (!driver) throw new Error("Driver not found");
  return driver;
}

export async function ensureDqfChecklist(driverId: string, companyId: string) {
  await requireCompanyDriver(driverId, companyId);
  const existing = await prisma.driverQualificationItem.findMany({
    where: { driverId },
    select: { category: true }
  });
  const have = new Set(existing.map((item) => item.category));
  const missing = DQF_CATEGORIES.filter((cat) => cat.required && !have.has(cat.id));

  if (missing.length === 0) return;

  await prisma.driverQualificationItem.createMany({
    data: missing.map((cat) => ({
      driverId,
      category: cat.id,
      title: cat.title,
      status: "MISSING"
    }))
  });
}

export async function upsertDqfItem(formData: FormData) {
  const user = await requireWriteUser();
  await assertPlanFeature(user.companyId, "driver_qualification");

  const driverId = requiredString(formData, "driverId");
  await requireCompanyDriver(driverId, user.companyId);

  const itemId = optionalString(formData, "itemId");
  const category = requiredString(formData, "category");
  const title =
    optionalString(formData, "title") ??
    DQF_CATEGORIES.find((c) => c.id === category)?.title ??
    category;
  const issuedAt = optionalDate(formData, "issuedAt");
  const expiresAt = optionalDate(formData, "expiresAt");
  const notes = optionalString(formData, "notes") ?? null;

  const file = formData.get("file");
  let filePath: string | undefined;
  let originalFileName: string | undefined;
  let mimeType: string | undefined;
  let fileSizeBytes: number | undefined;

  if (file instanceof File && file.size > 0) {
    const stored = await saveUploadedFile(user.companyId, file);
    filePath = stored.storedPath;
    originalFileName = file.name;
    mimeType = file.type;
    fileSizeBytes = file.size;
  }

  if (itemId) {
    const existing = await prisma.driverQualificationItem.findFirst({
      where: { id: itemId, driverId }
    });
    if (!existing) throw new Error("DQF item not found");

    if (filePath && existing.filePath) {
      await deleteStoredFile(existing.filePath);
    }

    const nextPath = filePath ?? existing.filePath;
    await prisma.driverQualificationItem.update({
      where: { id: itemId },
      data: {
        title,
        issuedAt,
        expiresAt,
        notes,
        status: resolveDqfStatus(expiresAt, Boolean(nextPath)),
        ...(filePath
          ? {
              filePath,
              originalFileName,
              mimeType,
              fileSizeBytes
            }
          : {})
      }
    });
  } else {
    await prisma.driverQualificationItem.create({
      data: {
        driverId,
        category,
        title,
        issuedAt,
        expiresAt,
        notes,
        status: resolveDqfStatus(expiresAt, Boolean(filePath)),
        filePath: filePath ?? null,
        originalFileName: originalFileName ?? null,
        mimeType: mimeType ?? null,
        fileSizeBytes: fileSizeBytes ?? null
      }
    });
  }

  revalidatePath(`/fleet/drivers/${driverId}`);
  revalidatePath("/fleet/compliance");
  redirect(`/fleet/drivers/${driverId}?saved=1`);
}

export async function deleteDqfItem(formData: FormData) {
  const user = await requireWriteUser();
  await assertPlanFeature(user.companyId, "driver_qualification");

  const itemId = requiredString(formData, "itemId");
  const driverId = requiredString(formData, "driverId");
  await requireCompanyDriver(driverId, user.companyId);

  const item = await prisma.driverQualificationItem.findFirst({
    where: { id: itemId, driverId }
  });
  if (!item) throw new Error("DQF item not found");

  if (item.filePath) {
    await deleteStoredFile(item.filePath);
  }

  await prisma.driverQualificationItem.delete({ where: { id: itemId } });

  revalidatePath(`/fleet/drivers/${driverId}`);
  redirect(`/fleet/drivers/${driverId}?saved=1`);
}
