"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { canAccessBranchRecord, resolveBranchId } from "@/lib/scope";
import { requireWriteUser } from "@/lib/permissions";
import {
  buildBillOfLading,
  buildCustomerInvoice,
  buildRateConfirmation,
  documentTitle
} from "@/lib/document-templates";
import { normalizeCarrierNumber } from "@/lib/carrier-numbers";
import { parseMoneyToCents } from "@/lib/format";
import { recalculateLoadCommission } from "@/lib/commission";
import { deleteStoredFile, saveUploadedFile } from "@/lib/document-storage";
import {
  parseDocumentTypesFromForm,
  primaryDocumentType,
  serializeDocumentTypes
} from "@/lib/document-types";

function requiredString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) {
    throw new Error(`${key} is required`);
  }

  return value;
}

function optionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || undefined;
}

function optionalDate(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value ? new Date(value) : undefined;
}

async function loadForDocument(loadId: string, user: SessionUser) {
  const load = await prisma.load.findUniqueOrThrow({
    where: { id: loadId, companyId: user.companyId },
    include: {
      customer: { include: { contacts: true } },
      stops: true,
      charges: true,
      dispatchAssignment: {
        include: {
          carrier: { include: { contacts: true } }
        }
      },
      invoices: { orderBy: { createdAt: "desc" } }
    }
  });

  if (!canAccessBranchRecord(user, load.branchId)) {
    throw new Error("Load not found.");
  }

  return load;
}

async function nextDocumentNumber(companyId: string, prefix: string) {
  const count = await prisma.loadDocument.count({
    where: { companyId, documentNumber: { startsWith: prefix } }
  });
  return `${prefix}-${String(count + 1001).padStart(4, "0")}`;
}

async function nextInvoiceNumber(companyId: string) {
  const count = await prisma.invoice.count({ where: { companyId } });
  return `INV-${String(count + 1001).padStart(4, "0")}`;
}

async function requireCompanyLoad(loadId: string, user: SessionUser) {
  const load = await prisma.load.findUniqueOrThrow({ where: { id: loadId, companyId: user.companyId } });

  if (!canAccessBranchRecord(user, load.branchId)) {
    throw new Error("Load not found.");
  }

  return load;
}

async function requireCompanyCarrier(carrierId: string, companyId: string) {
  return prisma.carrier.findUniqueOrThrow({ where: { id: carrierId, companyId } });
}

async function duplicateCarrierAuthority(
  companyId: string,
  mcNumberNormalized?: string,
  dotNumberNormalized?: string,
  excludeCarrierId?: string
) {
  if (!mcNumberNormalized && !dotNumberNormalized) {
    return null;
  }

  const carriers = await prisma.carrier.findMany({
    where: {
      companyId,
      id: excludeCarrierId ? { not: excludeCarrierId } : undefined
    },
    select: {
      name: true,
      mcNumber: true,
      mcNumberNormalized: true,
      dotNumber: true,
      dotNumberNormalized: true
    }
  });

  for (const carrier of carriers) {
    if (
      mcNumberNormalized &&
      (carrier.mcNumberNormalized === mcNumberNormalized ||
        normalizeCarrierNumber(carrier.mcNumber ?? undefined) === mcNumberNormalized)
    ) {
      return `MC number already exists for ${carrier.name}`;
    }

    if (
      dotNumberNormalized &&
      (carrier.dotNumberNormalized === dotNumberNormalized ||
        normalizeCarrierNumber(carrier.dotNumber ?? undefined) === dotNumberNormalized)
    ) {
      return `DOT number already exists for ${carrier.name}`;
    }
  }

  return null;
}

async function syncCarrierInsuranceSummary(carrierId: string) {
  const coverages = await prisma.carrierInsuranceCoverage.findMany({
    where: { carrierId, expiresAt: { not: null } },
    orderBy: { expiresAt: "asc" }
  });

  await prisma.carrier.update({
    where: { id: carrierId },
    data: { insuranceExpiresAt: coverages[0]?.expiresAt ?? null }
  });
}

async function requireCompanyCustomer(customerId: string, user: SessionUser) {
  const customer = await prisma.customer.findUniqueOrThrow({
    where: { id: customerId, companyId: user.companyId }
  });

  if (!canAccessBranchRecord(user, customer.branchId)) {
    throw new Error("Customer not found.");
  }

  return customer;
}

async function facilitySnapshot(formData: FormData, prefix: "pickup" | "delivery", companyId: string) {
  const facilityId = optionalString(formData, `${prefix}FacilityId`);

  if (facilityId) {
    const facility = await prisma.facility.findUniqueOrThrow({
      where: { id: facilityId, companyId }
    });

    return {
      facilityId: facility.id,
      facilityName: facility.name,
      address: facility.address ?? undefined,
      city: facility.city,
      state: facility.state,
      postalCode: facility.postalCode ?? undefined
    };
  }

  return {
    facilityName: requiredString(formData, `${prefix}Facility`),
    address: optionalString(formData, `${prefix}Address`),
    city: requiredString(formData, `${prefix}City`),
    state: requiredString(formData, `${prefix}State`),
    postalCode: optionalString(formData, `${prefix}PostalCode`)
  };
}

export async function createCustomer(formData: FormData) {
  const user = await requireWriteUser();
  const branchId = await resolveBranchId(user, optionalString(formData, "branchId"), prisma);

  await prisma.customer.create({
    data: {
      companyId: user.companyId,
      branchId,
      name: requiredString(formData, "name"),
      status: requiredString(formData, "status"),
      creditLimit: parseMoneyToCents(formData.get("creditLimit")),
      paymentTerms: requiredString(formData, "paymentTerms"),
      industry: optionalString(formData, "industry"),
      phone: optionalString(formData, "phone"),
      email: optionalString(formData, "email"),
      address: optionalString(formData, "address"),
      city: optionalString(formData, "city"),
      state: optionalString(formData, "state"),
      postalCode: optionalString(formData, "postalCode"),
      contacts: {
        create: {
          name: optionalString(formData, "contactName") ?? "Primary Contact",
          title: optionalString(formData, "contactTitle"),
          email: optionalString(formData, "contactEmail"),
          phone: optionalString(formData, "contactPhone"),
          isPrimary: true
        }
      }
    }
  });

  revalidatePath("/customers");
  redirect("/customers");
}

export async function createCarrier(formData: FormData) {
  const user = await requireWriteUser();
  const insuranceExpiresAt = optionalDate(formData, "insuranceExpiresAt");
  const mcNumber = optionalString(formData, "mcNumber");
  const dotNumber = optionalString(formData, "dotNumber");
  const mcNumberNormalized = normalizeCarrierNumber(mcNumber);
  const dotNumberNormalized = normalizeCarrierNumber(dotNumber);
  const duplicate = await duplicateCarrierAuthority(
    user.companyId,
    mcNumberNormalized,
    dotNumberNormalized
  );

  if (duplicate) {
    redirect(`/carriers?error=${encodeURIComponent(duplicate)}`);
  }

  await prisma.carrier.create({
    data: {
      companyId: user.companyId,
      branchId: user.branchId,
      name: requiredString(formData, "name"),
      status: requiredString(formData, "status"),
      mcNumber,
      mcNumberNormalized,
      dotNumber,
      dotNumberNormalized,
      phone: optionalString(formData, "phone"),
      email: optionalString(formData, "email"),
      address: optionalString(formData, "address"),
      city: optionalString(formData, "city"),
      state: optionalString(formData, "state"),
      postalCode: optionalString(formData, "postalCode"),
      equipmentTypes: optionalString(formData, "equipmentTypes"),
      safetyRating: optionalString(formData, "safetyRating"),
      complianceStatus: requiredString(formData, "complianceStatus"),
      insuranceExpiresAt,
      insuranceCoverages: insuranceExpiresAt
        ? {
            create: {
              coverageType: "AUTO_LIABILITY",
              expiresAt: insuranceExpiresAt,
              status: "Current",
              notes: "Created from the carrier summary insurance date."
            }
          }
        : undefined,
      contacts: {
        create: {
          name: optionalString(formData, "contactName") ?? "Dispatcher",
          title: optionalString(formData, "contactTitle"),
          email: optionalString(formData, "contactEmail"),
          phone: optionalString(formData, "contactPhone"),
          isPrimary: true
        }
      }
    }
  });

  revalidatePath("/carriers");
  redirect("/carriers");
}

export async function updateCarrier(formData: FormData) {
  const user = await requireWriteUser();
  const carrierId = requiredString(formData, "carrierId");
  await requireCompanyCarrier(carrierId, user.companyId);
  const mcNumber = optionalString(formData, "mcNumber");
  const dotNumber = optionalString(formData, "dotNumber");
  const mcNumberNormalized = normalizeCarrierNumber(mcNumber);
  const dotNumberNormalized = normalizeCarrierNumber(dotNumber);
  const duplicate = await duplicateCarrierAuthority(
    user.companyId,
    mcNumberNormalized,
    dotNumberNormalized,
    carrierId
  );

  if (duplicate) {
    redirect(`/carriers/${carrierId}?error=${encodeURIComponent(duplicate)}`);
  }

  await prisma.carrier.update({
    where: { id: carrierId },
    data: {
      name: requiredString(formData, "name"),
      status: requiredString(formData, "status"),
      mcNumber,
      mcNumberNormalized,
      dotNumber,
      dotNumberNormalized,
      phone: optionalString(formData, "phone"),
      email: optionalString(formData, "email"),
      address: optionalString(formData, "address"),
      city: optionalString(formData, "city"),
      state: optionalString(formData, "state"),
      postalCode: optionalString(formData, "postalCode"),
      equipmentTypes: optionalString(formData, "equipmentTypes"),
      safetyRating: optionalString(formData, "safetyRating"),
      complianceStatus: requiredString(formData, "complianceStatus")
    }
  });

  revalidatePath("/carriers");
  revalidatePath(`/carriers/${carrierId}`);
}

export async function createCarrierInsuranceCoverage(formData: FormData) {
  const user = await requireWriteUser();
  const carrierId = requiredString(formData, "carrierId");
  await requireCompanyCarrier(carrierId, user.companyId);

  await prisma.carrierInsuranceCoverage.create({
    data: {
      carrierId,
      coverageType: requiredString(formData, "coverageType"),
      insurerName: optionalString(formData, "insurerName"),
      policyNumber: optionalString(formData, "policyNumber"),
      limitAmount: optionalString(formData, "limitAmount"),
      effectiveAt: optionalDate(formData, "effectiveAt"),
      expiresAt: optionalDate(formData, "expiresAt"),
      status: requiredString(formData, "status"),
      notes: optionalString(formData, "notes")
    }
  });

  await syncCarrierInsuranceSummary(carrierId);
  revalidatePath("/carriers");
  revalidatePath(`/carriers/${carrierId}`);
}

export async function updateCarrierInsuranceCoverage(formData: FormData) {
  const user = await requireWriteUser();
  const coverageId = requiredString(formData, "coverageId");
  const coverage = await prisma.carrierInsuranceCoverage.findUniqueOrThrow({
    where: { id: coverageId },
    include: { carrier: true }
  });

  if (coverage.carrier.companyId !== user.companyId) {
    throw new Error("Coverage not found.");
  }

  await prisma.carrierInsuranceCoverage.update({
    where: { id: coverageId },
    data: {
      coverageType: requiredString(formData, "coverageType"),
      insurerName: optionalString(formData, "insurerName"),
      policyNumber: optionalString(formData, "policyNumber"),
      limitAmount: optionalString(formData, "limitAmount"),
      effectiveAt: optionalDate(formData, "effectiveAt"),
      expiresAt: optionalDate(formData, "expiresAt"),
      status: requiredString(formData, "status"),
      notes: optionalString(formData, "notes")
    }
  });

  await syncCarrierInsuranceSummary(coverage.carrierId);
  revalidatePath("/carriers");
  revalidatePath(`/carriers/${coverage.carrierId}`);
}

export async function createFacility(formData: FormData) {
  const user = await requireWriteUser();
  const customerId = optionalString(formData, "customerId");

  if (customerId) {
    await requireCompanyCustomer(customerId, user);
  }

  await prisma.facility.create({
    data: {
      companyId: user.companyId,
      branchId: user.branchId,
      customerId,
      name: requiredString(formData, "name"),
      type: requiredString(formData, "type"),
      status: requiredString(formData, "status"),
      address: optionalString(formData, "address"),
      city: requiredString(formData, "city"),
      state: requiredString(formData, "state"),
      postalCode: optionalString(formData, "postalCode"),
      phone: optionalString(formData, "phone"),
      email: optionalString(formData, "email"),
      contactName: optionalString(formData, "contactName"),
      notes: optionalString(formData, "notes")
    }
  });

  revalidatePath("/locations");
  revalidatePath("/loads/new");
  redirect("/locations");
}

export async function updateFacility(formData: FormData) {
  const user = await requireWriteUser();
  const facilityId = requiredString(formData, "facilityId");
  const customerId = optionalString(formData, "customerId");

  await prisma.facility.findUniqueOrThrow({ where: { id: facilityId, companyId: user.companyId } });

  if (customerId) {
    await requireCompanyCustomer(customerId, user);
  }

  await prisma.facility.update({
    where: { id: facilityId },
    data: {
      customerId,
      name: requiredString(formData, "name"),
      type: requiredString(formData, "type"),
      status: requiredString(formData, "status"),
      address: optionalString(formData, "address"),
      city: requiredString(formData, "city"),
      state: requiredString(formData, "state"),
      postalCode: optionalString(formData, "postalCode"),
      phone: optionalString(formData, "phone"),
      email: optionalString(formData, "email"),
      contactName: optionalString(formData, "contactName"),
      notes: optionalString(formData, "notes")
    }
  });

  revalidatePath("/locations");
  revalidatePath("/loads/new");
}

export async function createLoad(formData: FormData) {
  const user = await requireWriteUser();
  const customerId = requiredString(formData, "customerId");
  await requireCompanyCustomer(customerId, user);
  const branchId = await resolveBranchId(user, optionalString(formData, "branchId"), prisma);

  const manualLoadNumber = optionalString(formData, "loadNumber");
  const pickupDate = optionalDate(formData, "pickupDate") ?? new Date();
  const deliveryDate = optionalDate(formData, "deliveryDate") ?? pickupDate;
  const revenueCents = parseMoneyToCents(formData.get("revenue"));
  const carrierCostCents = parseMoneyToCents(formData.get("carrierCost"));
  const pickup = await facilitySnapshot(formData, "pickup", user.companyId);
  const delivery = await facilitySnapshot(formData, "delivery", user.companyId);

  const load = await prisma.$transaction(async (tx) => {
    const company = await tx.company.findUniqueOrThrow({ where: { id: user.companyId } });
    const loadNumber =
      manualLoadNumber ??
      `${company.loadNumberPrefix}-${String(company.nextLoadSequence).padStart(4, "0")}`;

    const createdLoad = await tx.load.create({
      data: {
        companyId: user.companyId,
        branchId,
        loadNumber,
        title: requiredString(formData, "title"),
        status: requiredString(formData, "status"),
        customerId,
        referenceNumber: optionalString(formData, "referenceNumber"),
        equipmentType: requiredString(formData, "equipmentType"),
        commodity: optionalString(formData, "commodity"),
        weight: Number(formData.get("weight") || 0) || undefined,
        pickupCity: pickup.city,
        pickupState: pickup.state,
        deliveryCity: delivery.city,
        deliveryState: delivery.state,
        pickupDate,
        deliveryDate,
        revenueCents,
        carrierCostCents,
        stops: {
          create: [
            {
              type: "PICKUP",
              sequence: 1,
              ...pickup,
              appointmentAt: pickupDate,
              instructions: optionalString(formData, "pickupInstructions")
            },
            {
              type: "DELIVERY",
              sequence: 2,
              ...delivery,
              appointmentAt: deliveryDate,
              instructions: optionalString(formData, "deliveryInstructions")
            }
          ]
        },
        charges: {
          create: {
            label: "Linehaul",
            chargeType: "Linehaul",
            amountCents: revenueCents
          }
        },
        activities: {
          create: {
            userId: user.id,
            action: "Load created",
            details: "Created from the TMS load entry form."
          }
        }
      }
    });

    if (!manualLoadNumber) {
      await tx.company.update({
        where: { id: user.companyId },
        data: { nextLoadSequence: { increment: 1 } }
      });
    }

    return createdLoad;
  });

  await recalculateLoadCommission(load.id);

  revalidatePath("/loads");
  revalidatePath("/commissions");
  redirect(`/loads/${load.id}`);
}

export async function updateLoadStatus(formData: FormData) {
  const user = await requireWriteUser();
  const loadId = requiredString(formData, "loadId");
  const status = requiredString(formData, "status");
  await requireCompanyLoad(loadId, user);

  await prisma.load.update({
    where: { id: loadId },
    data: {
      status,
      activities: {
        create: {
          userId: user.id,
          action: "Status changed",
          details: `Load moved to ${status}.`
        }
      }
    }
  });

  await recalculateLoadCommission(loadId);

  revalidatePath("/loads");
  revalidatePath("/commissions");
  revalidatePath(`/loads/${loadId}`);
}

export async function deleteLoad(formData: FormData) {
  const user = await requireWriteUser();
  const loadId = requiredString(formData, "loadId");
  const load = await requireCompanyLoad(loadId, user);

  const documents = await prisma.loadDocument.findMany({
    where: { loadId },
    select: { filePath: true }
  });

  for (const document of documents) {
    await deleteStoredFile(document.filePath);
  }

  await prisma.$transaction([
    prisma.invoice.deleteMany({ where: { loadId } }),
    prisma.carrierBill.deleteMany({ where: { loadId } }),
    prisma.load.delete({ where: { id: loadId } })
  ]);

  revalidatePath("/loads");
  revalidatePath("/search");
  revalidatePath("/commissions");
  revalidatePath("/dispatch");
  redirect("/loads");
}

export async function assignCarrier(formData: FormData) {
  const user = await requireWriteUser();
  const loadId = requiredString(formData, "loadId");
  const carrierId = requiredString(formData, "carrierId");
  const rateCents = parseMoneyToCents(formData.get("rate"));
  await requireCompanyLoad(loadId, user);
  await requireCompanyCarrier(carrierId, user.companyId);

  await prisma.load.update({
    where: { id: loadId },
    data: {
      status: "COVERED",
      carrierCostCents: rateCents,
      dispatchAssignment: {
        upsert: {
          create: {
            carrierId,
            driverName: optionalString(formData, "driverName"),
            driverPhone: optionalString(formData, "driverPhone"),
            truckNumber: optionalString(formData, "truckNumber"),
            trailerNumber: optionalString(formData, "trailerNumber"),
            rateCents
          },
          update: {
            carrierId,
            driverName: optionalString(formData, "driverName"),
            driverPhone: optionalString(formData, "driverPhone"),
            truckNumber: optionalString(formData, "truckNumber"),
            trailerNumber: optionalString(formData, "trailerNumber"),
            rateCents
          }
        }
      },
      activities: {
        create: {
          userId: user.id,
          action: "Carrier assigned",
          details: `Carrier assignment updated at ${parseMoneyToCents(formData.get("rate")) / 100}.`
        }
      }
    }
  });

  await recalculateLoadCommission(loadId);

  revalidatePath("/dispatch");
  revalidatePath("/loads");
  revalidatePath("/commissions");
  revalidatePath(`/loads/${loadId}`);
}

export async function addCheckCall(formData: FormData) {
  const user = await requireWriteUser();
  const assignmentId = requiredString(formData, "assignmentId");
  const loadId = requiredString(formData, "loadId");
  await requireCompanyLoad(loadId, user);

  await prisma.checkCall.create({
    data: {
      assignmentId,
      location: requiredString(formData, "location"),
      status: requiredString(formData, "status"),
      notes: optionalString(formData, "notes"),
      nextCheckAt: optionalDate(formData, "nextCheckAt")
    }
  });

  await prisma.loadActivity.create({
    data: {
      loadId,
      userId: user.id,
      action: "Check call added",
      details: `${requiredString(formData, "status")} at ${requiredString(formData, "location")}.`
    }
  });

  revalidatePath("/dispatch");
  revalidatePath(`/loads/${loadId}`);
}

async function validateDocumentEntityLinks(
  user: SessionUser,
  loadId?: string,
  customerId?: string,
  carrierId?: string
) {
  if (loadId) {
    await requireCompanyLoad(loadId, user);
  }
  if (customerId) {
    await requireCompanyCustomer(customerId, user);
  }
  if (carrierId) {
    await requireCompanyCarrier(carrierId, user.companyId);
  }
}

function revalidateDocumentPaths(
  document: {
    id: string;
    loadId?: string | null;
    customerId?: string | null;
    carrierId?: string | null;
  }
) {
  revalidatePath("/documents");
  revalidatePath(`/documents/${document.id}`);
  revalidatePath("/loads");

  if (document.loadId) {
    revalidatePath(`/loads/${document.loadId}`);
  }
  if (document.customerId) {
    revalidatePath(`/customers/${document.customerId}`);
  }
  if (document.carrierId) {
    revalidatePath(`/carriers/${document.carrierId}`);
  }
}

export async function uploadDocument(formData: FormData) {
  const user = await requireWriteUser();
  const loadId = optionalString(formData, "loadId");
  const customerId = optionalString(formData, "customerId");
  const carrierId = optionalString(formData, "carrierId");
  const redirectTo = optionalString(formData, "redirectTo");

  await validateDocumentEntityLinks(user, loadId, customerId, carrierId);

  const file = formData.get("file");
  const types = parseDocumentTypesFromForm(formData);
  const nameFromForm = optionalString(formData, "name");
  const notes = optionalString(formData, "notes");
  const isCompanyDocument = formData.get("isCompanyDocument") === "on";

  let filePath: string | undefined;
  let mimeType: string | undefined;
  let originalFileName: string | undefined;
  let fileSizeBytes: number | undefined;

  if (file instanceof File && file.size > 0) {
    const stored = await saveUploadedFile(user.companyId, file);
    filePath = stored.storedPath;
    mimeType = stored.mimeType;
    originalFileName = stored.originalFileName;
    fileSizeBytes = stored.fileSizeBytes;
  }

  const name = nameFromForm || originalFileName || "Uploaded Document";

  const document = await prisma.loadDocument.create({
    data: {
      companyId: user.companyId,
      loadId,
      customerId,
      carrierId,
      uploadedById: user.id,
      type: primaryDocumentType(types),
      types: serializeDocumentTypes(types),
      name,
      filePath,
      mimeType,
      originalFileName,
      fileSizeBytes,
      notes,
      status: filePath ? "PROCESSED" : "UPLOADED",
      isCompanyDocument
    }
  });

  if (loadId) {
    await prisma.loadActivity.create({
      data: {
        loadId,
        userId: user.id,
        action: "Document added",
        details: name
      }
    });
  }

  revalidateDocumentPaths(document);

  if (redirectTo) {
    redirect(redirectTo);
  }

  redirect(`/documents/${document.id}`);
}

export async function updateDocument(formData: FormData) {
  const user = await requireWriteUser();
  const documentId = requiredString(formData, "documentId");
  const existing = await prisma.loadDocument.findUniqueOrThrow({
    where: { id: documentId, companyId: user.companyId }
  });

  const loadId = optionalString(formData, "loadId");
  const customerId = optionalString(formData, "customerId");
  const carrierId = optionalString(formData, "carrierId");

  await validateDocumentEntityLinks(user, loadId, customerId, carrierId);

  const types = parseDocumentTypesFromForm(formData);
  const file = formData.get("file");

  let filePath = existing.filePath;
  let mimeType = existing.mimeType;
  let originalFileName = existing.originalFileName;
  let fileSizeBytes = existing.fileSizeBytes;

  if (file instanceof File && file.size > 0) {
    await deleteStoredFile(existing.filePath);
    const stored = await saveUploadedFile(user.companyId, file);
    filePath = stored.storedPath;
    mimeType = stored.mimeType;
    originalFileName = stored.originalFileName;
    fileSizeBytes = stored.fileSizeBytes;
  }

  const document = await prisma.loadDocument.update({
    where: { id: documentId },
    data: {
      loadId: loadId ?? null,
      customerId: customerId ?? null,
      carrierId: carrierId ?? null,
      type: primaryDocumentType(types, existing.type),
      types: serializeDocumentTypes(types),
      name: requiredString(formData, "name"),
      notes: optionalString(formData, "notes"),
      filePath,
      mimeType,
      originalFileName,
      fileSizeBytes,
      status: filePath ? "PROCESSED" : existing.status,
      isCompanyDocument: formData.get("isCompanyDocument") === "on"
    }
  });

  revalidateDocumentPaths(document);
  redirect(`/documents/${document.id}`);
}

export async function deleteDocument(formData: FormData) {
  const user = await requireWriteUser();
  const documentId = requiredString(formData, "documentId");
  const returnTo = optionalString(formData, "returnTo") ?? "/documents";

  const existing = await prisma.loadDocument.findUniqueOrThrow({
    where: { id: documentId, companyId: user.companyId }
  });

  await deleteStoredFile(existing.filePath);
  await prisma.loadDocument.delete({ where: { id: documentId } });

  revalidateDocumentPaths(existing);
  redirect(returnTo);
}

export async function addDocument(formData: FormData) {
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    return uploadDocument(formData);
  }

  const user = await requireWriteUser();
  const loadId = optionalString(formData, "loadId");
  const customerId = optionalString(formData, "customerId");
  const carrierId = optionalString(formData, "carrierId");

  await validateDocumentEntityLinks(user, loadId, customerId, carrierId);

  const types = parseDocumentTypesFromForm(formData);

  const document = await prisma.loadDocument.create({
    data: {
      companyId: user.companyId,
      loadId,
      customerId,
      carrierId,
      uploadedById: user.id,
      type: primaryDocumentType(types),
      types: serializeDocumentTypes(types),
      name: requiredString(formData, "name"),
      filePath: optionalString(formData, "filePath"),
      notes: optionalString(formData, "notes"),
      status: optionalString(formData, "filePath") ? "PROCESSED" : "UPLOADED"
    }
  });

  if (loadId) {
    await prisma.loadActivity.create({
      data: {
        loadId,
        userId: user.id,
        action: "Document added",
        details: requiredString(formData, "name")
      }
    });
  }

  revalidateDocumentPaths(document);
}

export async function generateRateConfirmation(formData: FormData) {
  const user = await requireWriteUser();
  const loadId = requiredString(formData, "loadId");
  const load = await loadForDocument(loadId, user);

  if (!load.dispatchAssignment) {
    throw new Error("Assign a carrier before generating a rate confirmation.");
  }

  const documentNumber = await nextDocumentNumber(user.companyId, "RC");
  const document = await prisma.loadDocument.create({
    data: {
      companyId: user.companyId,
      loadId: load.id,
      carrierId: load.dispatchAssignment.carrierId,
      type: "RATE_CONFIRMATION",
      name: documentTitle("RATE_CONFIRMATION", load.loadNumber),
      documentNumber,
      generatedContent: buildRateConfirmation(load, documentNumber),
      generatedAt: new Date(),
      notes: "Generated carrier rate confirmation."
    }
  });

  await prisma.loadActivity.create({
    data: {
      loadId,
      userId: user.id,
      action: "Rate confirmation generated",
      details: documentNumber
    }
  });

  revalidatePath("/documents");
  revalidatePath(`/loads/${loadId}`);
  redirect(`/documents/${document.id}`);
}

export async function generateBillOfLading(formData: FormData) {
  const user = await requireWriteUser();
  const loadId = requiredString(formData, "loadId");
  const load = await loadForDocument(loadId, user);
  const documentNumber = await nextDocumentNumber(user.companyId, "BOL");

  const document = await prisma.loadDocument.create({
    data: {
      companyId: user.companyId,
      loadId: load.id,
      customerId: load.customerId,
      type: "BOL",
      name: documentTitle("BOL", load.loadNumber),
      documentNumber,
      generatedContent: buildBillOfLading(load, documentNumber),
      generatedAt: new Date(),
      notes: "Generated bill of lading."
    }
  });

  await prisma.loadActivity.create({
    data: {
      loadId,
      userId: user.id,
      action: "BOL generated",
      details: documentNumber
    }
  });

  revalidatePath("/documents");
  revalidatePath(`/loads/${loadId}`);
  redirect(`/documents/${document.id}`);
}

export async function generateCustomerInvoice(formData: FormData) {
  const user = await requireWriteUser();
  const loadId = requiredString(formData, "loadId");
  const load = await loadForDocument(loadId, user);
  const invoiceNumber = await nextInvoiceNumber(user.companyId);
  const issuedAt = new Date();
  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + 30);

  const invoice =
    load.invoices[0] ??
    (await prisma.invoice.create({
      data: {
        companyId: user.companyId,
        invoiceNo: invoiceNumber,
        loadId: load.id,
        customerId: load.customerId,
        status: "DRAFT",
        totalCents: load.revenueCents,
        issuedAt,
        dueAt
      }
    }));

  const refreshedLoad = await loadForDocument(loadId, user);
  const document = await prisma.loadDocument.create({
    data: {
      companyId: user.companyId,
      loadId: load.id,
      customerId: load.customerId,
      type: "INVOICE",
      name: documentTitle("INVOICE", load.loadNumber),
      documentNumber: invoice.invoiceNo,
      generatedContent: buildCustomerInvoice(refreshedLoad, invoice.invoiceNo),
      generatedAt: new Date(),
      notes: "Generated customer invoice."
    }
  });

  await prisma.loadActivity.create({
    data: {
      loadId,
      userId: user.id,
      action: "Customer invoice generated",
      details: invoice.invoiceNo
    }
  });

  revalidatePath("/accounting");
  revalidatePath("/documents");
  revalidatePath(`/loads/${loadId}`);
  redirect(`/documents/${document.id}`);
}

export async function createInvoice(formData: FormData) {
  const user = await requireWriteUser();
  const loadId = requiredString(formData, "loadId");
  const load = await requireCompanyLoad(loadId, user);

  await prisma.invoice.create({
    data: {
      companyId: user.companyId,
      invoiceNo: requiredString(formData, "invoiceNo"),
      loadId,
      customerId: load.customerId,
      status: requiredString(formData, "status"),
      totalCents: parseMoneyToCents(formData.get("total")),
      issuedAt: optionalDate(formData, "issuedAt"),
      dueAt: optionalDate(formData, "dueAt")
    }
  });

  revalidatePath("/accounting");
  revalidatePath(`/loads/${loadId}`);
}

export async function createCarrierBill(formData: FormData) {
  const user = await requireWriteUser();
  const loadId = requiredString(formData, "loadId");
  const carrierId = requiredString(formData, "carrierId");
  await requireCompanyLoad(loadId, user);
  await requireCompanyCarrier(carrierId, user.companyId);

  await prisma.carrierBill.create({
    data: {
      companyId: user.companyId,
      billNo: requiredString(formData, "billNo"),
      loadId,
      carrierId,
      status: requiredString(formData, "status"),
      totalCents: parseMoneyToCents(formData.get("total")),
      receivedAt: optionalDate(formData, "receivedAt"),
      dueAt: optionalDate(formData, "dueAt")
    }
  });

  revalidatePath("/accounting");
  revalidatePath(`/loads/${loadId}`);
}
