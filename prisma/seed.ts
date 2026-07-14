import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { seedCompanyCatalogs } from "../lib/catalogs";

const prisma = new PrismaClient();
const seedPassword = "ChangeMe123!";

function hashSeedPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

const daysFromNow = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

async function createDemoPdfFiles() {
  const uploadDir = path.resolve(process.env.UPLOAD_DIR?.trim() || "./uploads", "demo");
  await mkdir(uploadDir, { recursive: true });

  const demoPdf = Buffer.from(
    "%PDF-1.4\n1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] >>endobj\nxref\n0 4\ntrailer<< /Root 1 0 R /Size 4 >>\nstartxref\n149\n%%EOF\n"
  );

  const files = [
    "blue-ridge-insurance.pdf",
    "blue-ridge-w9.pdf",
    "glb-1001-rate-confirmation.pdf",
    "glb-1001-bol.pdf"
  ];

  await Promise.all(files.map((fileName) => writeFile(path.join(uploadDir, fileName), demoPdf)));
}

async function main() {
  await prisma.session.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.companyMembership.deleteMany();
  await prisma.seatSubscription.deleteMany();
  await prisma.checkCall.deleteMany();
  await prisma.dispatchAssignment.deleteMany();
  await prisma.loadCommission.deleteMany();
  await prisma.loadExpense.deleteMany();
  await prisma.carrierBill.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.loadActivity.deleteMany();
  await prisma.loadNote.deleteMany();
  await prisma.loadDocument.deleteMany();
  await prisma.loadCharge.deleteMany();
  await prisma.loadStop.deleteMany();
  await prisma.load.deleteMany();
  await prisma.carrierInsuranceCoverage.deleteMany();
  await prisma.carrierComplianceDocument.deleteMany();
  await prisma.carrierContact.deleteMany();
  await prisma.customerContact.deleteMany();
  await prisma.facility.deleteMany();
  await prisma.integrationAccount.deleteMany();
  await prisma.accountingExport.deleteMany();
  await prisma.carrier.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.commissionProfileRule.deleteMany();
  await prisma.commissionProfile.deleteMany();
  await prisma.company.deleteMany();

  const company = await prisma.company.create({
    data: {
      name: "Great Lakes Brokerage",
      slug: "great-lakes-brokerage",
      status: "ACTIVE",
      loadNumberPrefix: "GLB",
      nextLoadSequence: 1003
    }
  });

  const branch = await prisma.branch.create({
    data: {
      companyId: company.id,
      name: "Great Lakes Brokerage",
      city: "Detroit",
      state: "MI"
    }
  });

  const commissionProfile = await prisma.commissionProfile.create({
    data: {
      companyId: company.id,
      name: "Standard 60/40",
      isDefault: true,
      rule: {
        create: {
          branchSharePercent: 60,
          companySharePercent: 40,
          companyMinimumExpensePercent: 10
        }
      }
    }
  });

  await prisma.branch.update({
    where: { id: branch.id },
    data: { commissionProfileId: commissionProfile.id }
  });

  const owner = await prisma.user.create({
    data: {
      name: "Jordan Miles",
      email: "owner@example.com",
      passwordHash: hashSeedPassword(seedPassword),
      mustChangePassword: false
    }
  });

  const dispatcher = await prisma.user.create({
    data: {
      name: "Avery Chen",
      email: "dispatch@example.com",
      passwordHash: hashSeedPassword(seedPassword),
      mustChangePassword: true
    }
  });

  await prisma.companyMembership.create({
    data: {
      userId: owner.id,
      companyId: company.id,
      branchId: branch.id,
      role: "OWNER",
      status: "ACTIVE",
      seatAssignedAt: new Date()
    }
  });

  await prisma.companyMembership.create({
    data: {
      userId: dispatcher.id,
      companyId: company.id,
      branchId: branch.id,
      role: "DISPATCHER",
      status: "ACTIVE",
      seatAssignedAt: new Date()
    }
  });

  await prisma.seatSubscription.create({
    data: {
      companyId: company.id,
      seatQuantity: 2,
      status: "ACTIVE"
    }
  });

  await seedCompanyCatalogs(company.id, prisma);

  const customer = await prisma.customer.create({
    data: {
      name: "Northstar Foods",
      status: "Active",
      creditLimit: 25000000,
      paymentTerms: "Net 30",
      industry: "Food and beverage",
      phone: "313-555-0144",
      email: "logistics@northstar.example",
      city: "Detroit",
      state: "MI",
      companyId: company.id,
      branchId: branch.id,
      contacts: {
        create: [
          {
            name: "Mia Thompson",
            title: "Logistics Manager",
            email: "mia@northstar.example",
            phone: "313-555-0145",
            isPrimary: true
          }
        ]
      }
    }
  });

  const customerTwo = await prisma.customer.create({
    data: {
      name: "Summit Retail Group",
      status: "Active",
      creditLimit: 17500000,
      paymentTerms: "Net 21",
      industry: "Retail",
      phone: "614-555-0199",
      email: "freight@summit.example",
      city: "Columbus",
      state: "OH",
      companyId: company.id,
      branchId: branch.id,
      contacts: {
        create: [
          {
            name: "Leo Ramirez",
            title: "Transportation Analyst",
            email: "leo@summit.example",
            phone: "614-555-0121",
            isPrimary: true
          }
        ]
      }
    }
  });

  const northstarPlant = await prisma.facility.create({
    data: {
      companyId: company.id,
      branchId: branch.id,
      customerId: customer.id,
      name: "Northstar Foods Plant 4",
      type: "SHIPPER",
      address: "4100 East Jefferson Ave",
      city: "Detroit",
      state: "MI",
      postalCode: "48207",
      phone: "313-555-0160",
      contactName: "Dock Supervisor",
      notes: "Pre-cool reefer trailers before arrival."
    }
  });

  const chicagoDistribution = await prisma.facility.create({
    data: {
      companyId: company.id,
      branchId: branch.id,
      customerId: customer.id,
      name: "Chicago South Distribution",
      type: "CONSIGNEE",
      address: "2200 Logistics Park Dr",
      city: "Joliet",
      state: "IL",
      postalCode: "60436",
      phone: "815-555-0129",
      contactName: "Receiving Office",
      notes: "Lumper receipts required."
    }
  });

  const summitCrossdock = await prisma.facility.create({
    data: {
      companyId: company.id,
      branchId: branch.id,
      customerId: customerTwo.id,
      name: "Summit Retail Crossdock",
      type: "SHIPPER",
      address: "1550 Westbelt Dr",
      city: "Columbus",
      state: "OH",
      postalCode: "43228"
    }
  });

  const nashvilleBuildout = await prisma.facility.create({
    data: {
      companyId: company.id,
      branchId: branch.id,
      customerId: customerTwo.id,
      name: "Nashville Store Buildout",
      type: "CONSIGNEE",
      address: "900 Commerce Way",
      city: "Nashville",
      state: "TN",
      postalCode: "37203"
    }
  });

  const carrier = await prisma.carrier.create({
    data: {
      companyId: company.id,
      name: "Blue Ridge Transport",
      status: "Active",
      mcNumber: "MC-784512",
      mcNumberNormalized: "MC784512",
      dotNumber: "DOT-2418890",
      dotNumberNormalized: "DOT2418890",
      phone: "865-555-0177",
      email: "dispatch@blueridge.example",
      address: "1200 Industrial Blvd",
      city: "Knoxville",
      state: "TN",
      postalCode: "37920",
      equipmentTypes: "Dry Van, Reefer",
      safetyRating: "Satisfactory",
      complianceStatus: "Approved",
      insuranceExpiresAt: daysFromNow(64),
      branchId: branch.id,
      insuranceCoverages: {
        create: [
          {
            coverageType: "AUTO_LIABILITY",
            insurerName: "Mutual Transport Insurance",
            policyNumber: "AL-884512",
            limitAmount: "$1,000,000",
            effectiveAt: daysFromNow(-300),
            expiresAt: daysFromNow(64),
            status: "Current"
          },
          {
            coverageType: "CARGO",
            insurerName: "Mutual Transport Insurance",
            policyNumber: "CG-884512",
            limitAmount: "$250,000",
            effectiveAt: daysFromNow(-300),
            expiresAt: daysFromNow(64),
            status: "Current"
          }
        ]
      },
      contacts: {
        create: [
          {
            name: "Nolan Price",
            title: "Dispatcher",
            email: "nolan@blueridge.example",
            phone: "865-555-0178",
            isPrimary: true
          }
        ]
      }
    }
  });

  await prisma.loadDocument.createMany({
    data: [
      {
        companyId: company.id,
        carrierId: carrier.id,
        uploadedById: owner.id,
        type: "INSURANCE_PROOF",
        types: JSON.stringify(["INSURANCE_PROOF"]),
        name: "Cargo and Auto Liability Certificate",
        filePath: "demo/blue-ridge-insurance.pdf",
        originalFileName: "blue-ridge-insurance.pdf",
        mimeType: "application/pdf",
        status: "PROCESSED",
        notes: "Carrier insurance certificate on file."
      },
      {
        companyId: company.id,
        carrierId: carrier.id,
        uploadedById: owner.id,
        type: "W9",
        types: JSON.stringify(["W9"]),
        name: "Signed W-9",
        filePath: "demo/blue-ridge-w9.pdf",
        originalFileName: "blue-ridge-w9.pdf",
        mimeType: "application/pdf",
        status: "PROCESSED"
      }
    ]
  });

  await prisma.carrier.create({
    data: {
      companyId: company.id,
      name: "Prairie Line Logistics",
      status: "Active",
      mcNumber: "MC-552904",
      mcNumberNormalized: "MC552904",
      dotNumber: "DOT-1983342",
      dotNumberNormalized: "DOT1983342",
      phone: "515-555-0108",
      email: "ops@prairieline.example",
      equipmentTypes: "Flatbed, Step Deck",
      safetyRating: "Satisfactory",
      complianceStatus: "Review Soon",
      insuranceExpiresAt: daysFromNow(18),
      branchId: branch.id,
      insuranceCoverages: {
        create: [
          {
            coverageType: "AUTO_LIABILITY",
            insurerName: "Prairie Mutual",
            policyNumber: "AL-552904",
            limitAmount: "$1,000,000",
            effectiveAt: daysFromNow(-347),
            expiresAt: daysFromNow(18),
            status: "Expiring Soon"
          },
          {
            coverageType: "CARGO",
            insurerName: "Prairie Mutual",
            policyNumber: "CG-552904",
            limitAmount: "$150,000",
            effectiveAt: daysFromNow(-347),
            expiresAt: daysFromNow(18),
            status: "Expiring Soon"
          }
        ]
      }
    }
  });

  await prisma.load.create({
    data: {
      companyId: company.id,
      loadNumber: "GLB-1001",
      title: "Frozen entrees to Chicago DC",
      status: "DISPATCHED",
      customerId: customer.id,
      branchId: branch.id,
      referenceNumber: "PO-884201",
      equipmentType: "Reefer",
      commodity: "Frozen prepared meals",
      weight: 38500,
      pickupCity: "Detroit",
      pickupState: "MI",
      deliveryCity: "Joliet",
      deliveryState: "IL",
      pickupDate: daysFromNow(1),
      deliveryDate: daysFromNow(2),
      revenueCents: 285000,
      carrierCostCents: 220000,
      stops: {
        create: [
          {
            type: "PICKUP",
            sequence: 1,
            facilityId: northstarPlant.id,
            facilityName: "Northstar Foods Plant 4",
            address: "4100 East Jefferson Ave",
            city: "Detroit",
            state: "MI",
            postalCode: "48207",
            appointmentAt: daysFromNow(1),
            instructions: "Pre-cool trailer to -10 F."
          },
          {
            type: "DELIVERY",
            sequence: 2,
            facilityId: chicagoDistribution.id,
            facilityName: "Chicago South Distribution",
            address: "2200 Logistics Park Dr",
            city: "Joliet",
            state: "IL",
            postalCode: "60436",
            appointmentAt: daysFromNow(2),
            instructions: "Lumper receipt required."
          }
        ]
      },
      charges: {
        create: [
          { label: "Linehaul", chargeType: "Linehaul", amountCents: 275000 },
          { label: "Fuel surcharge", chargeType: "Fuel", amountCents: 10000 }
        ]
      },
      dispatchAssignment: {
        create: {
          carrierId: carrier.id,
          driverName: "Sam Brooks",
          driverPhone: "865-555-0202",
          truckNumber: "BR-212",
          trailerNumber: "RF-8801",
          rateCents: 220000,
          checkCalls: {
            create: [
              {
                location: "Fort Wayne, IN",
                status: "On schedule",
                notes: "Driver checked in by phone. Reefer temp holding.",
                occurredAt: daysFromNow(0),
                nextCheckAt: daysFromNow(1)
              }
            ]
          }
        }
      },
      documents: {
        create: [
          {
            companyId: company.id,
            uploadedById: dispatcher.id,
            carrierId: carrier.id,
            type: "RATE_CONFIRMATION",
            types: JSON.stringify(["RATE_CONFIRMATION"]),
            name: "Carrier Rate Confirmation",
            filePath: "demo/glb-1001-rate-confirmation.pdf",
            originalFileName: "glb-1001-rate-confirmation.pdf",
            mimeType: "application/pdf",
            status: "PROCESSED"
          },
          {
            companyId: company.id,
            uploadedById: dispatcher.id,
            customerId: customer.id,
            type: "BOL",
            types: JSON.stringify(["BOL"]),
            name: "Bill of Lading",
            filePath: "demo/glb-1001-bol.pdf",
            originalFileName: "glb-1001-bol.pdf",
            mimeType: "application/pdf",
            status: "PROCESSED"
          }
        ]
      },
      notes: {
        create: [
          {
            userId: dispatcher.id,
            body: "Customer requested automatic updates at pickup and delivery."
          }
        ]
      },
      activities: {
        create: [
          {
            userId: owner.id,
            action: "Load created",
            details: "Imported from customer tender."
          },
          {
            userId: dispatcher.id,
            action: "Carrier assigned",
            details: "Blue Ridge Transport accepted at $2,200."
          }
        ]
      },
      invoices: {
        create: [
          {
            companyId: company.id,
            invoiceNo: "INV-1001",
            customerId: customer.id,
            status: "DRAFT",
            totalCents: 285000,
            issuedAt: daysFromNow(2),
            dueAt: daysFromNow(32)
          }
        ]
      },
      carrierBills: {
        create: [
          {
            companyId: company.id,
            billNo: "CB-1001",
            carrierId: carrier.id,
            status: "APPROVED",
            totalCents: 220000,
            receivedAt: daysFromNow(2),
            dueAt: daysFromNow(9)
          }
        ]
      },
      expenses: {
        create: [{ label: "Lumper fee", expenseType: "Lumper", amountCents: 5000 }]
      }
    }
  });

  await prisma.load.create({
    data: {
      companyId: company.id,
      loadNumber: "GLB-1002",
      title: "Retail fixtures to Nashville",
      status: "AVAILABLE",
      customerId: customerTwo.id,
      branchId: branch.id,
      referenceNumber: "SRG-33018",
      equipmentType: "Dry Van",
      commodity: "Store fixtures",
      weight: 22000,
      pickupCity: "Columbus",
      pickupState: "OH",
      deliveryCity: "Nashville",
      deliveryState: "TN",
      pickupDate: daysFromNow(3),
      deliveryDate: daysFromNow(4),
      revenueCents: 195000,
      carrierCostCents: 150000,
      stops: {
        create: [
          {
            type: "PICKUP",
            sequence: 1,
            facilityId: summitCrossdock.id,
            facilityName: "Summit Retail Crossdock",
            address: "1550 Westbelt Dr",
            city: "Columbus",
            state: "OH",
            postalCode: "43228",
            appointmentAt: daysFromNow(3)
          },
          {
            type: "DELIVERY",
            sequence: 2,
            facilityId: nashvilleBuildout.id,
            facilityName: "Nashville Store Buildout",
            address: "900 Commerce Way",
            city: "Nashville",
            state: "TN",
            postalCode: "37203",
            appointmentAt: daysFromNow(4)
          }
        ]
      },
      charges: {
        create: [
          { label: "Linehaul", chargeType: "Linehaul", amountCents: 195000 }
        ]
      },
      notes: {
        create: [
          {
            userId: owner.id,
            body: "Post to preferred carriers before public load boards."
          }
        ]
      },
      activities: {
        create: [
          {
            userId: owner.id,
            action: "Load created",
            details: "Ready for carrier sales."
          }
        ]
      }
    }
  });

  await prisma.load.create({
    data: {
      companyId: company.id,
      loadNumber: "GLB-1003",
      title: "Paper goods to Indianapolis",
      status: "PAID",
      customerId: customer.id,
      branchId: branch.id,
      equipmentType: "Dry Van",
      commodity: "Paper products",
      weight: 41000,
      pickupCity: "Detroit",
      pickupState: "MI",
      deliveryCity: "Indianapolis",
      deliveryState: "IN",
      pickupDate: daysFromNow(-5),
      deliveryDate: daysFromNow(-4),
      revenueCents: 100000,
      carrierCostCents: 70000,
      stops: {
        create: [
          {
            type: "PICKUP",
            sequence: 1,
            facilityName: "Detroit Warehouse",
            city: "Detroit",
            state: "MI",
            appointmentAt: daysFromNow(-5)
          },
          {
            type: "DELIVERY",
            sequence: 2,
            facilityName: "Indianapolis DC",
            city: "Indianapolis",
            state: "IN",
            appointmentAt: daysFromNow(-4)
          }
        ]
      },
      charges: {
        create: [{ label: "Linehaul", chargeType: "Linehaul", amountCents: 100000 }]
      },
      invoices: {
        create: [
          {
            companyId: company.id,
            invoiceNo: "INV-1003",
            customerId: customer.id,
            status: "PAID",
            totalCents: 100000,
            issuedAt: daysFromNow(-4),
            dueAt: daysFromNow(26),
            paidAt: daysFromNow(-2)
          }
        ]
      },
      dispatchAssignment: {
        create: {
          carrierId: carrier.id,
          driverName: "Pat Lee",
          rateCents: 70000
        }
      }
    }
  });

  const { recalculateLoadCommission } = await import("../lib/commission");
  const seededLoads = await prisma.load.findMany({ where: { companyId: company.id }, select: { id: true } });
  for (const load of seededLoads) {
    await recalculateLoadCommission(load.id);
  }

  await createDemoPdfFiles();

  await prisma.integrationAccount.createMany({
    data: [
      {
        companyId: company.id,
        provider: "DAT",
        displayName: "DAT Load Board",
        status: "Not Connected",
        notes: "Future posting and truck search integration."
      },
      {
        companyId: company.id,
        provider: "TRUCKSTOP",
        displayName: "Truckstop",
        status: "Not Connected",
        notes: "Future rate and posting integration."
      },
      {
        companyId: company.id,
        provider: "QUICKBOOKS",
        displayName: "QuickBooks Online",
        status: "Not Connected",
        notes: "Sync invoices and carrier bills via QuickBooks Online API."
      },
      {
        companyId: company.id,
        provider: "TRUCKER_TOOLS",
        displayName: "Tracking and Document Capture",
        status: "Not Connected",
        notes: "Future driver tracking and POD capture."
      }
    ]
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
