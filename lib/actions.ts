"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { canAccessRecord } from "@/lib/branch-filter-server";
import { resolveBranchId } from "@/lib/scope";
import { assertPlanFeature, requireWriteUser } from "@/lib/permissions";
import { getPlan } from "@/lib/plans";
import { getCompanyPlan } from "@/lib/seats";
import { documentTitle, isPrivateLoadNote } from "@/lib/document-templates";
import {
  getCompanyBranding,
  plainTextForType
} from "@/lib/document-generate";
import { enqueueJob } from "@/lib/jobs";
import { normalizeCarrierNumber } from "@/lib/carrier-numbers";
import { parseMoneyToCents } from "@/lib/format";
import { LATE_FEE_CHARGE_TYPE, parseLateFeePercent } from "@/lib/late-fees";
import { recalculateLoadCommission } from "@/lib/commission";
import { deleteStoredFile, saveUploadedFile } from "@/lib/document-storage";
import {
  parseDocumentTypesFromForm,
  primaryDocumentType,
  serializeDocumentTypes
} from "@/lib/document-types";
import { ensureCompanyCatalogs } from "@/lib/catalogs";
import {
  chargesCreateData,
  customerChargesTotalCents,
  isLateFeeCharge,
  parseCustomerChargesFromForm
} from "@/lib/customer-charges";
import { dueDateFromTerms, parsePaymentTermsDays } from "@/lib/accounting-aging";
import { resolveCarrierApPayee } from "@/lib/accounting-payee";
import {
  commodityLinesCreateData,
  parseFreightLinesFromForm,
  rollupCommodity,
  rollupWeight
} from "@/lib/load-commodity";
import {
  firstPickup,
  lastDelivery,
  laneTitle,
  parseLoadStopsFromForm,
  stopsCreateData
} from "@/lib/load-stops";

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

function optionalFloat(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function loadForDocument(loadId: string, user: SessionUser) {
  const load = await prisma.load.findUniqueOrThrow({
    where: { id: loadId, companyId: user.companyId },
    include: {
      customer: { include: { contacts: true } },
      stops: true,
      commodityLines: { orderBy: { sequence: "asc" } },
      charges: true,
      carrierPayLines: {
        orderBy: { sortOrder: "asc" },
        include: { lineType: true }
      },
      dispatchAssignment: {
        include: {
          carrier: { include: { contacts: true } }
        }
      },
      invoices: { orderBy: { createdAt: "desc" } },
      notes: { orderBy: { createdAt: "asc" } }
    }
  });

  if (!(await canAccessRecord(user, load.branchId))) {
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

  if (!(await canAccessRecord(user, load.branchId))) {
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

  if (!(await canAccessRecord(user, customer.branchId))) {
    throw new Error("Customer not found.");
  }

  return customer;
}

function summarizeFieldChanges(
  before: Record<string, string | number | null | undefined>,
  after: Record<string, string | number | null | undefined>,
  labels: Record<string, string>
) {
  const changed = Object.keys(after).filter(
    (key) => String(before[key] ?? "") !== String(after[key] ?? "")
  );

  if (changed.length === 0) {
    return "No field changes detected.";
  }

  return `Updated ${changed.map((key) => labels[key] ?? key).join(", ")}.`;
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
      lateFeePercent: parseLateFeePercent(formData.get("lateFeePercent")),
      rateConfirmationTerms: optionalString(formData, "rateConfirmationTerms"),
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
      },
      activities: {
        create: {
          userId: user.id,
          action: "Customer created",
          details: "Created from the TMS customer entry form."
        }
      }
    }
  });

  revalidatePath("/customers");
  redirect("/customers?saved=1");
}

export async function updateCustomer(formData: FormData) {
  const user = await requireWriteUser();
  const customerId = requiredString(formData, "customerId");
  const existing = await requireCompanyCustomer(customerId, user);
  const hasBranchField = formData.has("branchId");
  const requestedBranchId = optionalString(formData, "branchId");
  const branchId = hasBranchField
    ? requestedBranchId
      ? await resolveBranchId(user, requestedBranchId, prisma)
      : null
    : existing.branchId;
  const next = {
    name: requiredString(formData, "name"),
    status: requiredString(formData, "status"),
    creditLimit: parseMoneyToCents(formData.get("creditLimit")),
    paymentTerms: requiredString(formData, "paymentTerms"),
    lateFeePercent: parseLateFeePercent(formData.get("lateFeePercent")),
    industry: optionalString(formData, "industry") ?? null,
    phone: optionalString(formData, "phone") ?? null,
    email: optionalString(formData, "email") ?? null,
    address: optionalString(formData, "address") ?? null,
    city: optionalString(formData, "city") ?? null,
    state: optionalString(formData, "state") ?? null,
    postalCode: optionalString(formData, "postalCode") ?? null,
    branchId,
    ...(formData.has("rateConfirmationTerms")
      ? { rateConfirmationTerms: optionalString(formData, "rateConfirmationTerms") ?? null }
      : {})
  };

  const contactTitle = optionalString(formData, "contactTitle") ?? null;
  const contactEmail = optionalString(formData, "contactEmail") ?? null;
  const contactPhone = optionalString(formData, "contactPhone") ?? null;

  const primaryContact = await prisma.customerContact.findFirst({
    where: { customerId },
    orderBy: [{ isPrimary: "desc" }, { name: "asc" }]
  });

  const resolvedContactName = optionalString(formData, "contactName") ?? primaryContact?.name ?? "Primary Contact";

  const details = summarizeFieldChanges(
    {
      name: existing.name,
      status: existing.status,
      creditLimit: existing.creditLimit,
      paymentTerms: existing.paymentTerms,
      lateFeePercent: existing.lateFeePercent,
      ...(formData.has("rateConfirmationTerms")
        ? { rateConfirmationTerms: existing.rateConfirmationTerms }
        : {}),
      industry: existing.industry,
      phone: existing.phone,
      email: existing.email,
      address: existing.address,
      city: existing.city,
      state: existing.state,
      postalCode: existing.postalCode,
      branchId: existing.branchId,
      contactName: primaryContact?.name,
      contactTitle: primaryContact?.title,
      contactEmail: primaryContact?.email,
      contactPhone: primaryContact?.phone
    },
    {
      ...next,
      contactName: resolvedContactName,
      contactTitle,
      contactEmail,
      contactPhone
    },
    {
      name: "name",
      status: "status",
      creditLimit: "credit limit",
      paymentTerms: "payment terms",
      lateFeePercent: "late fee percent",
      rateConfirmationTerms: "rate confirmation terms",
      industry: "industry",
      phone: "phone",
      email: "email",
      address: "address",
      city: "city",
      state: "state",
      postalCode: "postal code",
      branchId: "branch",
      contactName: "primary contact",
      contactTitle: "contact title",
      contactEmail: "contact email",
      contactPhone: "contact phone"
    }
  );

  await prisma.$transaction(async (tx) => {
    await tx.customer.update({
      where: { id: customerId },
      data: next
    });

    if (primaryContact) {
      await tx.customerContact.update({
        where: { id: primaryContact.id },
        data: {
          name: resolvedContactName,
          title: contactTitle,
          email: contactEmail,
          phone: contactPhone,
          isPrimary: true
        }
      });
    } else {
      await tx.customerContact.create({
        data: {
          customerId,
          name: resolvedContactName,
          title: contactTitle,
          email: contactEmail,
          phone: contactPhone,
          isPrimary: true
        }
      });
    }

    await tx.customerActivity.create({
      data: {
        customerId,
        userId: user.id,
        action: "Customer updated",
        details
      }
    });
  });

  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  redirect(`/customers/${customerId}?saved=1`);
}

export async function updateCustomerRateConfirmationTerms(formData: FormData) {
  const user = await requireWriteUser();
  const customerId = requiredString(formData, "customerId");
  await requireCompanyCustomer(customerId, user);
  const terms = optionalString(formData, "rateConfirmationTerms") ?? null;

  await prisma.customer.update({
    where: { id: customerId },
    data: {
      rateConfirmationTerms: terms,
      activities: {
        create: {
          userId: user.id,
          action: "Rate confirmation terms updated",
          details: terms?.trim()
            ? "Customer default rate confirmation terms were saved."
            : "Customer default rate confirmation terms were cleared."
        }
      }
    }
  });

  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
}

export async function addCustomerActivityNote(formData: FormData) {
  const user = await requireWriteUser();
  await assertPlanFeature(user.companyId, "crm_documents_activity");
  const customerId = requiredString(formData, "customerId");
  const body = requiredString(formData, "body");
  await requireCompanyCustomer(customerId, user);

  await prisma.customerActivity.create({
    data: {
      customerId,
      userId: user.id,
      action: "Activity note",
      details: body
    }
  });

  revalidatePath(`/customers/${customerId}`);
}

export async function createCarrier(formData: FormData) {
  const user = await requireWriteUser();
  const insuranceExpiresAt = optionalDate(formData, "insuranceExpiresAt");
  const mcNumber = optionalString(formData, "mcNumber");
  const dotNumber = optionalString(formData, "dotNumber");
  const mcNumberNormalized = normalizeCarrierNumber(mcNumber);
  const dotNumberNormalized = normalizeCarrierNumber(dotNumber);
  const factoringCompanyId = optionalString(formData, "factoringCompanyId");
  if (factoringCompanyId) {
    await assertPlanFeature(user.companyId, "factoring_assignment");
    await prisma.factoringCompany.findUniqueOrThrow({
      where: { id: factoringCompanyId, companyId: user.companyId }
    });
  }
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
      paymentTerms: optionalString(formData, "paymentTerms") ?? "Net 30",
      paymentMethod: optionalString(formData, "paymentMethod"),
      factoringCompanyId: factoringCompanyId || null,
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
      },
      activities: {
        create: {
          userId: user.id,
          action: "Carrier created",
          details: "Created from the TMS carrier entry form."
        }
      }
    }
  });

  revalidatePath("/carriers");
  redirect("/carriers?saved=1");
}

export async function updateCarrier(formData: FormData) {
  const user = await requireWriteUser();
  const carrierId = requiredString(formData, "carrierId");
  const existing = await requireCompanyCarrier(carrierId, user.companyId);
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

  const factoringCompanyId = optionalString(formData, "factoringCompanyId");
  if (factoringCompanyId) {
    await assertPlanFeature(user.companyId, "factoring_assignment");
    await prisma.factoringCompany.findUniqueOrThrow({
      where: { id: factoringCompanyId, companyId: user.companyId }
    });
  }

  const next = {
    name: requiredString(formData, "name"),
    status: requiredString(formData, "status"),
    mcNumber: mcNumber ?? null,
    mcNumberNormalized: mcNumberNormalized ?? null,
    dotNumber: dotNumber ?? null,
    dotNumberNormalized: dotNumberNormalized ?? null,
    phone: optionalString(formData, "phone") ?? null,
    email: optionalString(formData, "email") ?? null,
    address: optionalString(formData, "address") ?? null,
    city: optionalString(formData, "city") ?? null,
    state: optionalString(formData, "state") ?? null,
    postalCode: optionalString(formData, "postalCode") ?? null,
    equipmentTypes: optionalString(formData, "equipmentTypes") ?? null,
    safetyRating: optionalString(formData, "safetyRating") ?? null,
    complianceStatus: requiredString(formData, "complianceStatus"),
    paymentTerms: optionalString(formData, "paymentTerms") ?? "Net 30",
    paymentMethod: optionalString(formData, "paymentMethod") ?? null,
    factoringCompanyId: factoringCompanyId || null
  };

  const details = summarizeFieldChanges(
    {
      name: existing.name,
      status: existing.status,
      mcNumber: existing.mcNumber,
      dotNumber: existing.dotNumber,
      phone: existing.phone,
      email: existing.email,
      address: existing.address,
      city: existing.city,
      state: existing.state,
      postalCode: existing.postalCode,
      equipmentTypes: existing.equipmentTypes,
      safetyRating: existing.safetyRating,
      complianceStatus: existing.complianceStatus,
      paymentTerms: existing.paymentTerms,
      paymentMethod: existing.paymentMethod,
      factoringCompanyId: existing.factoringCompanyId
    },
    {
      name: next.name,
      status: next.status,
      mcNumber: next.mcNumber,
      dotNumber: next.dotNumber,
      phone: next.phone,
      email: next.email,
      address: next.address,
      city: next.city,
      state: next.state,
      postalCode: next.postalCode,
      equipmentTypes: next.equipmentTypes,
      safetyRating: next.safetyRating,
      complianceStatus: next.complianceStatus,
      paymentTerms: next.paymentTerms,
      paymentMethod: next.paymentMethod,
      factoringCompanyId: next.factoringCompanyId
    },
    {
      name: "name",
      status: "status",
      mcNumber: "MC number",
      dotNumber: "USDOT number",
      phone: "phone",
      email: "email",
      address: "address",
      city: "city",
      state: "state",
      postalCode: "postal code",
      equipmentTypes: "equipment types",
      safetyRating: "safety rating",
      complianceStatus: "compliance status",
      paymentTerms: "payment terms",
      paymentMethod: "payment method",
      factoringCompanyId: "factoring company"
    }
  );

  await prisma.carrier.update({
    where: { id: carrierId },
    data: {
      ...next,
      activities: {
        create: {
          userId: user.id,
          action: "Carrier updated",
          details
        }
      }
    }
  });

  revalidatePath("/carriers");
  revalidatePath(`/carriers/${carrierId}`);
  redirect(`/carriers/${carrierId}?saved=1`);
}

export async function addCarrierActivityNote(formData: FormData) {
  const user = await requireWriteUser();
  await assertPlanFeature(user.companyId, "crm_documents_activity");
  const carrierId = requiredString(formData, "carrierId");
  const body = requiredString(formData, "body");
  await requireCompanyCarrier(carrierId, user.companyId);

  await prisma.carrierActivity.create({
    data: {
      carrierId,
      userId: user.id,
      action: "Activity note",
      details: body
    }
  });

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
  redirect(`/carriers/${carrierId}?saved=1`);
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
  redirect(`/carriers/${coverage.carrierId}?saved=1`);
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
  redirect("/locations?saved=1");
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
  redirect("/locations?saved=1");
}

export async function createLoad(formData: FormData) {
  const user = await requireWriteUser();
  await assertPlanFeature(user.companyId, "loads_create");

  const plan = getPlan(await getCompanyPlan(user.companyId));
  if (plan.monthlyLoadCap != null) {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const createdThisMonth = await prisma.load.count({
      where: { companyId: user.companyId, createdAt: { gte: monthStart } }
    });
    if (createdThisMonth >= plan.monthlyLoadCap) {
      throw new Error(
        `Free plan allows ${plan.monthlyLoadCap} loads per month. Upgrade to Lite or Premium for unlimited loads.`
      );
    }
  }

  const customerId = requiredString(formData, "customerId");
  await requireCompanyCustomer(customerId, user);
  const branchId = await resolveBranchId(user, optionalString(formData, "branchId"), prisma);

  const manualLoadNumber = optionalString(formData, "loadNumber");
  let carrierCostCents = parseMoneyToCents(formData.get("carrierCost"));
  const equipmentType = requiredString(formData, "equipmentType");
  const reeferTempF = equipmentType === "Reefer" ? optionalFloat(formData, "reeferTempF") : null;
  const freightLines = parseFreightLinesFromForm(formData);
  const commodity = rollupCommodity(freightLines);
  const weight = rollupWeight(freightLines);
  const stops = await parseLoadStopsFromForm(formData, user.companyId);
  const origin = firstPickup(stops);
  const destination = lastDelivery(stops);

  await ensureCompanyCatalogs(user.companyId);
  const customerChargeLines = await parseCustomerChargesFromForm(
    formData,
    user.companyId,
    prisma
  );
  const revenueCents = customerChargesTotalCents(customerChargeLines);
  if (revenueCents < 0) {
    throw new Error("Customer rate total cannot be negative.");
  }

  const cloneFromLoadId = optionalString(formData, "cloneFromLoadId");
  const keepNotes = String(formData.get("keepNotes") ?? "").trim() === "1";
  const cloneCarrierId = optionalString(formData, "cloneCarrierId");

  let sourceLoad: { id: string; loadNumber: string } | null = null;
  if (cloneFromLoadId) {
    sourceLoad = await requireCompanyLoad(cloneFromLoadId, user);
  }

  type ClonePayLine = {
    lineTypeId: string;
    description?: string | null;
    unitRateCents: number;
    quantity: number;
    amountCents: number;
    sortOrder?: number;
  };

  let normalizedClonePayLines: ClonePayLine[] = [];
  if (cloneCarrierId) {
    await requireCompanyCarrier(cloneCarrierId, user.companyId);
    await ensureCompanyCatalogs(user.companyId);

    const payLinesRaw = String(formData.get("clonePayLinesJson") ?? "").trim();
    if (payLinesRaw) {
      let parsedLines: ClonePayLine[];
      try {
        parsedLines = JSON.parse(payLinesRaw);
      } catch {
        throw new Error("Invalid clone carrier pay line items.");
      }

      if (!Array.isArray(parsedLines)) {
        throw new Error("Invalid clone carrier pay line items.");
      }

      if (parsedLines.length > 0) {
        const lineTypeIds = [...new Set(parsedLines.map((line) => line.lineTypeId).filter(Boolean))];
        const lineTypes = await prisma.carrierPayLineType.findMany({
          where: { companyId: user.companyId, id: { in: lineTypeIds } }
        });
        const typeById = new Map(lineTypes.map((type) => [type.id, type]));

        normalizedClonePayLines = parsedLines.map((line, index) => {
          const lineType = typeById.get(line.lineTypeId);
          if (!lineType) {
            throw new Error("Invalid clone pay line type.");
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

          return {
            lineTypeId: lineType.id,
            description: line.description?.trim() || null,
            unitRateCents,
            quantity,
            amountCents,
            sortOrder: Number.isFinite(line.sortOrder) ? Number(line.sortOrder) : index
          };
        });

        const payTotal = normalizedClonePayLines.reduce((sum, line) => sum + line.amountCents, 0);
        if (payTotal > 0) {
          carrierCostCents = payTotal;
        }
      }
    }
  }

  const requestedStatus = requiredString(formData, "status");
  const initialStatus = cloneCarrierId ? "COVERED" : requestedStatus;
  const activityDetails = sourceLoad
    ? `Cloned from load ${sourceLoad.loadNumber}.`
    : "Created from the TMS load entry form.";
  const activityAction = sourceLoad ? "Load cloned" : "Load created";

  const load = await prisma.$transaction(async (tx) => {
    const company = await tx.company.findUniqueOrThrow({ where: { id: user.companyId } });
    const sequence = String(company.nextLoadSequence).padStart(4, "0");
    const loadNumber =
      manualLoadNumber ??
      (company.loadNumberPrefix ? `${company.loadNumberPrefix}-${sequence}` : sequence);

    const createdLoad = await tx.load.create({
      data: {
        companyId: user.companyId,
        branchId,
        loadNumber,
        title: laneTitle(stops),
        status: initialStatus,
        customerId,
        referenceNumber: optionalString(formData, "referenceNumber"),
        equipmentType,
        reeferTempF,
        commodity,
        weight,
        pickupCity: origin.city,
        pickupState: origin.state,
        deliveryCity: destination.city,
        deliveryState: destination.state,
        pickupDate: origin.appointmentAt,
        deliveryDate: destination.appointmentAt,
        revenueCents,
        carrierCostCents,
        rateConfirmationTerms: optionalString(formData, "rateConfirmationTerms"),
        stops: {
          create: stopsCreateData(stops)
        },
        commodityLines: {
          create: commodityLinesCreateData(freightLines)
        },
        charges: {
          create: chargesCreateData(customerChargeLines)
        },
        activities: {
          create: {
            userId: user.id,
            action: activityAction,
            details: activityDetails
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

    if (cloneCarrierId) {
      const assignment = await tx.dispatchAssignment.create({
        data: {
          loadId: createdLoad.id,
          carrierId: cloneCarrierId,
          driverName: optionalString(formData, "cloneDriverName"),
          driverPhone: optionalString(formData, "cloneDriverPhone"),
          truckNumber: optionalString(formData, "cloneTruckNumber"),
          trailerNumber: optionalString(formData, "cloneTrailerNumber"),
          rateCents: carrierCostCents
        }
      });

      if (normalizedClonePayLines.length > 0) {
        await tx.carrierPayLine.createMany({
          data: normalizedClonePayLines.map((line) => ({
            loadId: createdLoad.id,
            assignmentId: assignment.id,
            lineTypeId: line.lineTypeId,
            description: line.description,
            unitRateCents: line.unitRateCents,
            quantity: line.quantity,
            amountCents: line.amountCents,
            sortOrder: line.sortOrder ?? 0
          }))
        });
      }

      await tx.loadActivity.create({
        data: {
          loadId: createdLoad.id,
          userId: user.id,
          action: "Carrier assigned",
          details: `Carrier copied from cloned load with ${normalizedClonePayLines.length} pay line(s).`
        }
      });
    }

    if (keepNotes && sourceLoad) {
      const sourceNotes = await tx.loadNote.findMany({
        where: { loadId: sourceLoad.id },
        orderBy: { createdAt: "asc" }
      });
      const publicNotes = sourceNotes.filter((note) => !isPrivateLoadNote(note));
      if (publicNotes.length > 0) {
        const authorIds = [
          ...new Set(
            publicNotes
              .map((note) => note.userId)
              .filter((id): id is string => Boolean(id))
          )
        ];
        const validAuthors =
          authorIds.length > 0
            ? await tx.user.findMany({
                where: { id: { in: authorIds }, companyId: user.companyId },
                select: { id: true }
              })
            : [];
        const validAuthorIds = new Set(validAuthors.map((author) => author.id));

        await tx.loadNote.createMany({
          data: publicNotes.map((note) => ({
            loadId: createdLoad.id,
            userId:
              note.userId && validAuthorIds.has(note.userId) ? note.userId : user.id,
            body: note.body,
            isPrivate: false
          }))
        });
      }
    }

    return createdLoad;
  });

  await recalculateLoadCommission(load.id);

  revalidatePath("/loads");
  revalidatePath("/dispatch");
  revalidatePath("/commissions");
  redirect(`/loads/${load.id}?saved=1`);
}

export async function updateLoad(formData: FormData) {
  const user = await requireWriteUser();
  const loadId = requiredString(formData, "loadId");
  await requireCompanyLoad(loadId, user);

  const customerId = requiredString(formData, "customerId");
  await requireCompanyCustomer(customerId, user);
  const branchId = await resolveBranchId(user, optionalString(formData, "branchId"), prisma);

  const carrierCostCents = parseMoneyToCents(formData.get("carrierCost"));
  const equipmentType = requiredString(formData, "equipmentType");
  const reeferTempF = equipmentType === "Reefer" ? optionalFloat(formData, "reeferTempF") ?? null : null;
  const freightLines = parseFreightLinesFromForm(formData);
  const commodity = rollupCommodity(freightLines);
  const weight = rollupWeight(freightLines);
  const stops = await parseLoadStopsFromForm(formData, user.companyId);
  const origin = firstPickup(stops);
  const destination = lastDelivery(stops);

  await ensureCompanyCatalogs(user.companyId);
  const customerChargeLines = await parseCustomerChargesFromForm(
    formData,
    user.companyId,
    prisma
  );

  await prisma.$transaction(async (tx) => {
    await tx.loadCommodityLine.deleteMany({ where: { loadId } });
    await tx.loadStop.deleteMany({ where: { loadId } });

    const existingCharges = await tx.loadCharge.findMany({ where: { loadId } });
    const lateFeeCents = existingCharges
      .filter(isLateFeeCharge)
      .reduce((sum, charge) => sum + charge.amountCents, 0);
    const revenueCents = customerChargesTotalCents(customerChargeLines) + lateFeeCents;

    await tx.loadCharge.deleteMany({
      where: {
        loadId,
        chargeType: { not: LATE_FEE_CHARGE_TYPE }
      }
    });

    await tx.load.update({
      where: { id: loadId },
      data: {
        customerId,
        branchId,
        referenceNumber: optionalString(formData, "referenceNumber") ?? null,
        equipmentType,
        reeferTempF,
        commodity,
        weight,
        title: laneTitle(stops),
        pickupCity: origin.city,
        pickupState: origin.state,
        deliveryCity: destination.city,
        deliveryState: destination.state,
        pickupDate: origin.appointmentAt,
        deliveryDate: destination.appointmentAt,
        revenueCents,
        carrierCostCents,
        routeTotalMiles: null,
        routeStateMiles: Prisma.DbNull,
        routePolyline: null,
        routeComputedAt: null,
        commodityLines: {
          create: commodityLinesCreateData(freightLines)
        },
        stops: {
          create: stopsCreateData(stops)
        },
        charges: {
          create: chargesCreateData(customerChargeLines)
        },
        activities: {
          create: {
            userId: user.id,
            action: "Load details updated",
            details: "Updated load details, stops, freight lines, and customer charges."
          }
        }
      }
    });
  });

  await recalculateLoadCommission(loadId);

  revalidatePath("/loads");
  revalidatePath(`/loads/${loadId}`);
  revalidatePath("/dispatch");
  revalidatePath("/commissions");
  revalidatePath("/search");
  redirect(`/loads/${loadId}?saved=1`);
}

export async function updateLoadStatus(formData: FormData) {
  const user = await requireWriteUser();
  const loadId = requiredString(formData, "loadId");
  const status = requiredString(formData, "status");
  await requireCompanyLoad(loadId, user);

  const fullStatuses = new Set(["INVOICED", "PAID", "CANCELED"]);
  if (fullStatuses.has(status)) {
    await assertPlanFeature(user.companyId, "loads_full_status");
  }

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

  if (status === "DELIVERED" || status === "INVOICED" || status === "PAID") {
    const { ensureDeliveryStopGeocoded } = await import("@/lib/customer-load-map");
    await ensureDeliveryStopGeocoded(loadId);
  }

  await recalculateLoadCommission(loadId);

  revalidatePath("/loads");
  revalidatePath("/commissions");
  revalidatePath(`/loads/${loadId}`);
  revalidatePath("/portal");
}

export async function addLoadNote(formData: FormData) {
  const user = await requireWriteUser();
  await assertPlanFeature(user.companyId, "load_notes");
  const loadId = requiredString(formData, "loadId");
  const body = requiredString(formData, "body");
  const visibility = String(formData.get("visibility") ?? "public").trim().toLowerCase();
  const isPrivate = visibility === "private";
  await requireCompanyLoad(loadId, user);

  await prisma.$transaction([
    prisma.loadNote.create({
      data: {
        loadId,
        userId: user.id,
        body,
        isPrivate
      }
    }),
    prisma.loadActivity.create({
      data: {
        loadId,
        userId: user.id,
        action: isPrivate ? "Private note added" : "Public note added",
        details: body
      }
    })
  ]);

  revalidatePath(`/loads/${loadId}`);
}

export async function addLoadActivityNote(formData: FormData) {
  const user = await requireWriteUser();
  await assertPlanFeature(user.companyId, "load_notes");
  const loadId = requiredString(formData, "loadId");
  const body = requiredString(formData, "body");
  await requireCompanyLoad(loadId, user);

  await prisma.loadActivity.create({
    data: {
      loadId,
      userId: user.id,
      action: "Activity note",
      details: body
    }
  });

  revalidatePath(`/loads/${loadId}`);
}

export async function updateLoadRateConfirmationTerms(formData: FormData) {
  const user = await requireWriteUser();
  const loadId = requiredString(formData, "loadId");
  await requireCompanyLoad(loadId, user);
  const terms = optionalString(formData, "rateConfirmationTerms") ?? null;

  await prisma.load.update({
    where: { id: loadId },
    data: {
      rateConfirmationTerms: terms,
      activities: {
        create: {
          userId: user.id,
          action: "Rate confirmation terms updated",
          details: terms
            ? "Load-level rate confirmation terms override saved."
            : "Load-level override cleared; customer default will apply."
        }
      }
    }
  });

  revalidatePath(`/loads/${loadId}`);
}

export async function deleteLoad(formData: FormData) {
  const user = await requireWriteUser();
  await assertPlanFeature(user.companyId, "delete_loads");
  const loadId = requiredString(formData, "loadId");
  await requireCompanyLoad(loadId, user);

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
  await requireCompanyLoad(loadId, user);
  await requireCompanyCarrier(carrierId, user.companyId);
  await ensureCompanyCatalogs(user.companyId);

  const payLinesRaw = String(formData.get("payLinesJson") ?? "").trim();
  if (!payLinesRaw) {
    throw new Error("Add at least one carrier pay line item.");
  }

  let parsedLines: Array<{
    lineTypeId: string;
    description?: string | null;
    unitRateCents: number;
    quantity: number;
    amountCents: number;
    sortOrder?: number;
  }>;

  try {
    parsedLines = JSON.parse(payLinesRaw);
  } catch {
    throw new Error("Invalid carrier pay line items.");
  }

  if (!Array.isArray(parsedLines) || parsedLines.length === 0) {
    throw new Error("Add at least one carrier pay line item.");
  }

  const lineTypeIds = [...new Set(parsedLines.map((line) => line.lineTypeId).filter(Boolean))];
  const lineTypes = await prisma.carrierPayLineType.findMany({
    where: { companyId: user.companyId, id: { in: lineTypeIds } }
  });
  const typeById = new Map(lineTypes.map((type) => [type.id, type]));

  const normalizedLines = parsedLines.map((line, index) => {
    const lineType = typeById.get(line.lineTypeId);
    if (!lineType) {
      throw new Error("Invalid pay line type.");
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

    return {
      lineTypeId: lineType.id,
      description: line.description?.trim() || null,
      unitRateCents,
      quantity,
      amountCents,
      sortOrder: Number.isFinite(line.sortOrder) ? Number(line.sortOrder) : index
    };
  });

  const rateCents = normalizedLines.reduce((sum, line) => sum + line.amountCents, 0);
  if (rateCents <= 0) {
    throw new Error("Carrier pay total must be greater than zero.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.carrierPayLine.deleteMany({ where: { loadId } });

    await tx.load.update({
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
            details: `Carrier assignment updated with ${normalizedLines.length} pay line(s) totaling ${(rateCents / 100).toFixed(2)}.`
          }
        }
      }
    });

    const assignment = await tx.dispatchAssignment.findUniqueOrThrow({
      where: { loadId }
    });

    await tx.carrierPayLine.createMany({
      data: normalizedLines.map((line) => ({
        loadId,
        assignmentId: assignment.id,
        lineTypeId: line.lineTypeId,
        description: line.description,
        unitRateCents: line.unitRateCents,
        quantity: line.quantity,
        amountCents: line.amountCents,
        sortOrder: line.sortOrder
      }))
    });
  });

  await recalculateLoadCommission(loadId);

  revalidatePath("/dispatch");
  revalidatePath("/loads");
  revalidatePath("/commissions");
  revalidatePath(`/loads/${loadId}`);
}

export async function unassignCarrier(formData: FormData) {
  const user = await requireWriteUser();
  const loadId = requiredString(formData, "loadId");
  const load = await requireCompanyLoad(loadId, user);

  const assignment = await prisma.dispatchAssignment.findUnique({ where: { loadId } });
  if (!assignment) {
    redirect(`/loads/${loadId}?error=${encodeURIComponent("No carrier is assigned to this load.")}`);
  }

  if (["INVOICED", "PAID"].includes(load.status)) {
    redirect(
      `/loads/${loadId}?error=${encodeURIComponent("Cannot unassign a carrier from an invoiced or paid load.")}`
    );
  }

  const hasFleet = Boolean(assignment.driverId || assignment.truckId || assignment.trailerId);
  const nextStatus =
    !hasFleet && (load.status === "COVERED" || load.status === "DISPATCHED")
      ? "AVAILABLE"
      : load.status;

  await prisma.$transaction(async (tx) => {
    await tx.carrierPayLine.deleteMany({ where: { loadId } });

    if (hasFleet) {
      await tx.dispatchAssignment.update({
        where: { loadId },
        data: { carrierId: null, rateCents: 0 }
      });
      await tx.load.update({
        where: { id: loadId },
        data: {
          carrierCostCents: 0,
          activities: {
            create: {
              userId: user.id,
              action: "Carrier unassigned",
              details: "External carrier removed; fleet assignment retained."
            }
          }
        }
      });
    } else {
      await tx.dispatchAssignment.delete({ where: { loadId } });
      await tx.load.update({
        where: { id: loadId },
        data: {
          status: nextStatus,
          carrierCostCents: 0,
          activities: {
            create: {
              userId: user.id,
              action: "Carrier unassigned",
              details: "Carrier assignment and pay line items were removed."
            }
          }
        }
      });
    }
  });

  await recalculateLoadCommission(loadId);

  revalidatePath("/dispatch");
  revalidatePath("/loads");
  revalidatePath("/commissions");
  revalidatePath(`/loads/${loadId}`);
  redirect(`/loads/${loadId}?saved=1`);
}

export async function addCheckCall(formData: FormData) {
  const user = await requireWriteUser();
  const assignmentId = requiredString(formData, "assignmentId");
  const loadId = requiredString(formData, "loadId");
  await requireCompanyLoad(loadId, user);

  const location = requiredString(formData, "location");
  const status = requiredString(formData, "status");

  const checkCall = await prisma.checkCall.create({
    data: {
      assignmentId,
      location,
      status,
      notes: optionalString(formData, "notes"),
      nextCheckAt: optionalDate(formData, "nextCheckAt")
    }
  });

  const { geocodeAndStoreCheckCallLocation } = await import("@/lib/customer-load-map");
  await geocodeAndStoreCheckCallLocation(checkCall.id, location);

  await prisma.loadActivity.create({
    data: {
      loadId,
      userId: user.id,
      action: "Check call added",
      details: `${status} at ${location}.`
    }
  });

  revalidatePath("/dispatch");
  revalidatePath(`/loads/${loadId}`);
  revalidatePath("/portal");
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
  await assertPlanFeature(user.companyId, "documents_upload");
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
  await assertPlanFeature(user.companyId, "generate_rate_con");
  const loadId = requiredString(formData, "loadId");
  const load = await loadForDocument(loadId, user);

  if (!load.dispatchAssignment?.carrierId) {
    throw new Error("Assign a carrier before generating a rate confirmation.");
  }

  const documentNumber = await nextDocumentNumber(user.companyId, "RC");
  const company = await getCompanyBranding(user.companyId);

  const document = await prisma.loadDocument.create({
    data: {
      companyId: user.companyId,
      loadId: load.id,
      carrierId: load.dispatchAssignment.carrierId,
      type: "RATE_CONFIRMATION",
      name: documentTitle("RATE_CONFIRMATION", load.loadNumber),
      documentNumber,
      generatedContent: plainTextForType("RATE_CONFIRMATION", load, documentNumber, company),
      status: "PROCESSING",
      notes: "Generated carrier rate confirmation."
    }
  });

  await enqueueJob("GENERATE_PDF", {
    companyId: user.companyId,
    loadId: load.id,
    documentId: document.id,
    type: "RATE_CONFIRMATION",
    documentNumber
  });

  await prisma.loadActivity.create({
    data: {
      loadId,
      userId: user.id,
      action: "Rate confirmation queued",
      details: documentNumber
    }
  });

  revalidatePath("/documents");
  revalidatePath(`/loads/${loadId}`);
  redirect(`/documents/${document.id}`);
}

export async function generateBillOfLading(formData: FormData) {
  const user = await requireWriteUser();
  await assertPlanFeature(user.companyId, "generate_bol");
  const loadId = requiredString(formData, "loadId");
  const load = await loadForDocument(loadId, user);
  const documentNumber = `BOL-${load.loadNumber}`;
  const company = await getCompanyBranding(user.companyId);

  const document = await prisma.loadDocument.create({
    data: {
      companyId: user.companyId,
      loadId: load.id,
      customerId: load.customerId,
      type: "BOL",
      name: documentTitle("BOL", load.loadNumber),
      documentNumber,
      generatedContent: plainTextForType("BOL", load, documentNumber, company),
      status: "PROCESSING",
      notes: "Generated bill of lading."
    }
  });

  await enqueueJob("GENERATE_PDF", {
    companyId: user.companyId,
    loadId: load.id,
    documentId: document.id,
    type: "BOL",
    documentNumber
  });

  await prisma.loadActivity.create({
    data: {
      loadId,
      userId: user.id,
      action: "BOL queued",
      details: documentNumber
    }
  });

  revalidatePath("/documents");
  revalidatePath(`/loads/${loadId}`);
  redirect(`/documents/${document.id}`);
}

export async function generateCustomerInvoice(formData: FormData) {
  const user = await requireWriteUser();
  await assertPlanFeature(user.companyId, "generate_invoice_pdf");
  const loadId = requiredString(formData, "loadId");
  const load = await loadForDocument(loadId, user);
  const invoiceNumber = await nextInvoiceNumber(user.companyId);
  const issuedAt = new Date();
  const dueAt = dueDateFromTerms(issuedAt, load.customer.paymentTerms);

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
        balanceCents: load.revenueCents,
        issuedAt,
        dueAt
      }
    }));

  const refreshedLoad = await loadForDocument(loadId, user);
  const company = await getCompanyBranding(user.companyId);

  const document = await prisma.loadDocument.create({
    data: {
      companyId: user.companyId,
      loadId: load.id,
      customerId: load.customerId,
      type: "INVOICE",
      name: documentTitle("INVOICE", load.loadNumber),
      documentNumber: invoice.invoiceNo,
      generatedContent: plainTextForType("INVOICE", refreshedLoad, invoice.invoiceNo, company),
      status: "PROCESSING",
      notes: "Generated customer invoice."
    }
  });

  await enqueueJob("GENERATE_PDF", {
    companyId: user.companyId,
    loadId: load.id,
    documentId: document.id,
    type: "INVOICE",
    documentNumber: invoice.invoiceNo
  });

  await prisma.loadActivity.create({
    data: {
      loadId,
      userId: user.id,
      action: "Customer invoice queued",
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
  await assertPlanFeature(user.companyId, "accounting_ar_ap");
  const loadId = requiredString(formData, "loadId");
  const load = await requireCompanyLoad(loadId, user);
  const totalCents = parseMoneyToCents(formData.get("total"));
  const status = requiredString(formData, "status");

  await prisma.invoice.create({
    data: {
      companyId: user.companyId,
      invoiceNo: requiredString(formData, "invoiceNo"),
      loadId,
      customerId: load.customerId,
      status,
      totalCents,
      balanceCents: status === "PAID" || status === "VOID" ? 0 : totalCents,
      issuedAt: optionalDate(formData, "issuedAt"),
      dueAt: optionalDate(formData, "dueAt"),
      paidAt: status === "PAID" ? new Date() : undefined
    }
  });

  revalidatePath("/accounting");
  revalidatePath(`/loads/${loadId}`);
}

export async function createCarrierBill(formData: FormData) {
  const user = await requireWriteUser();
  await assertPlanFeature(user.companyId, "accounting_ar_ap");
  const loadId = requiredString(formData, "loadId");
  const carrierId = requiredString(formData, "carrierId");
  await requireCompanyLoad(loadId, user);
  await requireCompanyCarrier(carrierId, user.companyId);

  const totalCents = parseMoneyToCents(formData.get("total"));
  const status = optionalString(formData, "status") ?? "APPROVED";
  const payee = await resolveCarrierApPayee(carrierId, user.companyId);
  const receivedAt = optionalDate(formData, "receivedAt") ?? new Date();
  const termsRaw = optionalString(formData, "paymentTermsDays");
  const paymentTermsDays = termsRaw != null ? Number(termsRaw) : parsePaymentTermsDays(
    (await prisma.carrier.findUniqueOrThrow({ where: { id: carrierId } })).paymentTerms
  );
  const dueAt =
    optionalDate(formData, "dueAt") ??
    (() => {
      const due = new Date(receivedAt);
      due.setDate(due.getDate() + (Number.isFinite(paymentTermsDays) ? paymentTermsDays : 30));
      return due;
    })();

  const billNo =
    optionalString(formData, "billNo") ??
    (await (async () => {
      const count = await prisma.carrierBill.count({ where: { companyId: user.companyId } });
      return `CB-${String(count + 1001).padStart(4, "0")}`;
    })());

  const nameOnCheck = optionalString(formData, "nameOnCheck") ?? payee.nameOnCheck;
  const payeeName = optionalString(formData, "payeeName") ?? payee.displayName;

  await prisma.carrierBill.create({
    data: {
      companyId: user.companyId,
      billNo,
      loadId,
      carrierId,
      status,
      totalCents,
      balanceCents: status === "PAID" || status === "VOID" ? 0 : totalCents,
      payeeName,
      nameOnCheck,
      remitAddress: optionalString(formData, "remitAddress"),
      billReference: optionalString(formData, "billReference"),
      paymentTermsDays: Number.isFinite(paymentTermsDays) ? paymentTermsDays : 30,
      paymentMethod: optionalString(formData, "paymentMethod"),
      notes: optionalString(formData, "notes"),
      factoringCompanyId: payee.factoringCompanyId,
      receivedAt,
      dueAt,
      paidAt: status === "PAID" ? new Date() : undefined
    }
  });

  revalidatePath("/accounting");
  revalidatePath(`/loads/${loadId}`);
  redirect("/accounting?tab=bills&billSaved=1");
}

export async function updateCarrierBill(formData: FormData) {
  const user = await requireWriteUser();
  const billId = requiredString(formData, "billId");
  const bill = await prisma.carrierBill.findUniqueOrThrow({
    where: { id: billId, companyId: user.companyId },
    include: { load: true }
  });

  if (!(await canAccessRecord(user, bill.load.branchId))) {
    throw new Error("Carrier bill not found.");
  }

  if (bill.status === "PAID" || bill.status === "VOID") {
    throw new Error("Paid or void bills cannot be edited.");
  }

  const totalCents = parseMoneyToCents(formData.get("total"));
  const receivedAt = optionalDate(formData, "receivedAt") ?? bill.receivedAt ?? new Date();
  const termsRaw = optionalString(formData, "paymentTermsDays");
  const paymentTermsDays =
    termsRaw != null && termsRaw !== ""
      ? Number(termsRaw)
      : bill.paymentTermsDays ?? 30;
  const dueAt =
    optionalDate(formData, "dueAt") ??
    (() => {
      const due = new Date(receivedAt);
      due.setDate(due.getDate() + (Number.isFinite(paymentTermsDays) ? paymentTermsDays : 30));
      return due;
    })();

  const paidSoFar = bill.totalCents - bill.balanceCents;
  const balanceCents = Math.max(0, totalCents - paidSoFar);

  await prisma.carrierBill.update({
    where: { id: billId },
    data: {
      totalCents,
      balanceCents,
      status: balanceCents <= 0 ? "PAID" : bill.status === "DRAFT" ? "APPROVED" : bill.status,
      nameOnCheck: optionalString(formData, "nameOnCheck") ?? bill.nameOnCheck,
      payeeName: optionalString(formData, "payeeName") ?? bill.payeeName,
      remitAddress: optionalString(formData, "remitAddress"),
      billReference: optionalString(formData, "billReference"),
      paymentTermsDays: Number.isFinite(paymentTermsDays) ? paymentTermsDays : bill.paymentTermsDays,
      paymentMethod: optionalString(formData, "paymentMethod"),
      notes: optionalString(formData, "notes"),
      receivedAt,
      dueAt,
      paidAt: balanceCents <= 0 ? bill.paidAt ?? new Date() : null
    }
  });

  revalidatePath("/accounting");
  revalidatePath(`/loads/${bill.loadId}`);
  revalidatePath(`/accounting/bills/${billId}`);
  redirect("/accounting?tab=bills&billSaved=1");
}
