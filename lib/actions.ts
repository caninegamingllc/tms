"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  buildBillOfLading,
  buildCustomerInvoice,
  buildRateConfirmation,
  documentTitle
} from "@/lib/document-templates";
import { parseMoneyToCents } from "@/lib/format";

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

async function nextLoadNumber() {
  const count = await prisma.load.count();
  return `GLB-${String(count + 1001).padStart(4, "0")}`;
}

async function loadForDocument(loadId: string) {
  return prisma.load.findUniqueOrThrow({
    where: { id: loadId },
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
}

async function nextDocumentNumber(prefix: string) {
  const count = await prisma.loadDocument.count({
    where: { documentNumber: { startsWith: prefix } }
  });
  return `${prefix}-${String(count + 1001).padStart(4, "0")}`;
}

async function nextInvoiceNumber() {
  const count = await prisma.invoice.count();
  return `INV-${String(count + 1001).padStart(4, "0")}`;
}

export async function createCustomer(formData: FormData) {
  await prisma.customer.create({
    data: {
      name: requiredString(formData, "name"),
      status: requiredString(formData, "status"),
      creditLimit: parseMoneyToCents(formData.get("creditLimit")),
      paymentTerms: requiredString(formData, "paymentTerms"),
      industry: optionalString(formData, "industry"),
      phone: optionalString(formData, "phone"),
      email: optionalString(formData, "email"),
      city: optionalString(formData, "city"),
      state: optionalString(formData, "state"),
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
  await prisma.carrier.create({
    data: {
      name: requiredString(formData, "name"),
      status: requiredString(formData, "status"),
      mcNumber: optionalString(formData, "mcNumber"),
      dotNumber: optionalString(formData, "dotNumber"),
      phone: optionalString(formData, "phone"),
      email: optionalString(formData, "email"),
      equipmentTypes: optionalString(formData, "equipmentTypes"),
      safetyRating: optionalString(formData, "safetyRating"),
      complianceStatus: requiredString(formData, "complianceStatus"),
      insuranceExpiresAt: optionalDate(formData, "insuranceExpiresAt"),
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

export async function createLoad(formData: FormData) {
  const customerId = requiredString(formData, "customerId");
  const loadNumber = optionalString(formData, "loadNumber") ?? (await nextLoadNumber());
  const pickupDate = optionalDate(formData, "pickupDate") ?? new Date();
  const deliveryDate = optionalDate(formData, "deliveryDate") ?? pickupDate;
  const revenueCents = parseMoneyToCents(formData.get("revenue"));
  const carrierCostCents = parseMoneyToCents(formData.get("carrierCost"));

  const load = await prisma.load.create({
    data: {
      loadNumber,
      title: requiredString(formData, "title"),
      status: requiredString(formData, "status"),
      customerId,
      referenceNumber: optionalString(formData, "referenceNumber"),
      equipmentType: requiredString(formData, "equipmentType"),
      commodity: optionalString(formData, "commodity"),
      weight: Number(formData.get("weight") || 0) || undefined,
      pickupCity: requiredString(formData, "pickupCity"),
      pickupState: requiredString(formData, "pickupState"),
      deliveryCity: requiredString(formData, "deliveryCity"),
      deliveryState: requiredString(formData, "deliveryState"),
      pickupDate,
      deliveryDate,
      revenueCents,
      carrierCostCents,
      stops: {
        create: [
          {
            type: "PICKUP",
            sequence: 1,
            facilityName: requiredString(formData, "pickupFacility"),
            city: requiredString(formData, "pickupCity"),
            state: requiredString(formData, "pickupState"),
            appointmentAt: pickupDate,
            instructions: optionalString(formData, "pickupInstructions")
          },
          {
            type: "DELIVERY",
            sequence: 2,
            facilityName: requiredString(formData, "deliveryFacility"),
            city: requiredString(formData, "deliveryCity"),
            state: requiredString(formData, "deliveryState"),
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
          action: "Load created",
          details: "Created from the TMS load entry form."
        }
      }
    }
  });

  revalidatePath("/loads");
  redirect(`/loads/${load.id}`);
}

export async function updateLoadStatus(formData: FormData) {
  const loadId = requiredString(formData, "loadId");
  const status = requiredString(formData, "status");

  await prisma.load.update({
    where: { id: loadId },
    data: {
      status,
      activities: {
        create: {
          action: "Status changed",
          details: `Load moved to ${status}.`
        }
      }
    }
  });

  revalidatePath("/loads");
  revalidatePath(`/loads/${loadId}`);
}

export async function assignCarrier(formData: FormData) {
  const loadId = requiredString(formData, "loadId");
  const carrierId = requiredString(formData, "carrierId");
  const rateCents = parseMoneyToCents(formData.get("rate"));

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
          action: "Carrier assigned",
          details: `Carrier assignment updated at ${parseMoneyToCents(formData.get("rate")) / 100}.`
        }
      }
    }
  });

  revalidatePath("/dispatch");
  revalidatePath("/loads");
  revalidatePath(`/loads/${loadId}`);
}

export async function addCheckCall(formData: FormData) {
  const assignmentId = requiredString(formData, "assignmentId");
  const loadId = requiredString(formData, "loadId");

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
      action: "Check call added",
      details: `${requiredString(formData, "status")} at ${requiredString(formData, "location")}.`
    }
  });

  revalidatePath("/dispatch");
  revalidatePath(`/loads/${loadId}`);
}

export async function addDocument(formData: FormData) {
  const loadId = optionalString(formData, "loadId");
  const customerId = optionalString(formData, "customerId");
  const carrierId = optionalString(formData, "carrierId");

  await prisma.loadDocument.create({
    data: {
      loadId,
      customerId,
      carrierId,
      type: requiredString(formData, "type"),
      name: requiredString(formData, "name"),
      filePath: optionalString(formData, "filePath"),
      notes: optionalString(formData, "notes")
    }
  });

  if (loadId) {
    await prisma.loadActivity.create({
      data: {
        loadId,
        action: "Document added",
        details: requiredString(formData, "name")
      }
    });
  }

  revalidatePath("/documents");
  revalidatePath("/loads");
  if (loadId) {
    revalidatePath(`/loads/${loadId}`);
  }
}

export async function generateRateConfirmation(formData: FormData) {
  const loadId = requiredString(formData, "loadId");
  const load = await loadForDocument(loadId);

  if (!load.dispatchAssignment) {
    throw new Error("Assign a carrier before generating a rate confirmation.");
  }

  const documentNumber = await nextDocumentNumber("RC");
  const document = await prisma.loadDocument.create({
    data: {
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
      action: "Rate confirmation generated",
      details: documentNumber
    }
  });

  revalidatePath("/documents");
  revalidatePath(`/loads/${loadId}`);
  redirect(`/documents/${document.id}`);
}

export async function generateBillOfLading(formData: FormData) {
  const loadId = requiredString(formData, "loadId");
  const load = await loadForDocument(loadId);
  const documentNumber = await nextDocumentNumber("BOL");

  const document = await prisma.loadDocument.create({
    data: {
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
      action: "BOL generated",
      details: documentNumber
    }
  });

  revalidatePath("/documents");
  revalidatePath(`/loads/${loadId}`);
  redirect(`/documents/${document.id}`);
}

export async function generateCustomerInvoice(formData: FormData) {
  const loadId = requiredString(formData, "loadId");
  const load = await loadForDocument(loadId);
  const invoiceNumber = await nextInvoiceNumber();
  const issuedAt = new Date();
  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + 30);

  const invoice =
    load.invoices[0] ??
    (await prisma.invoice.create({
      data: {
        invoiceNo: invoiceNumber,
        loadId: load.id,
        customerId: load.customerId,
        status: "DRAFT",
        totalCents: load.revenueCents,
        issuedAt,
        dueAt
      }
    }));

  const refreshedLoad = await loadForDocument(loadId);
  const document = await prisma.loadDocument.create({
    data: {
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
  const loadId = requiredString(formData, "loadId");
  const load = await prisma.load.findUniqueOrThrow({ where: { id: loadId } });

  await prisma.invoice.create({
    data: {
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
  const loadId = requiredString(formData, "loadId");
  const carrierId = requiredString(formData, "carrierId");

  await prisma.carrierBill.create({
    data: {
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
