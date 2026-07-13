import "dotenv/config";
import { randomBytes, scryptSync } from "crypto";
import { PrismaClient } from "@prisma/client";
import { recalculateLoadCommission } from "../lib/commission";
import {
  assertKnownBranch,
  buildLoadTitle,
  extractBrokerAgent,
  fallbackStops,
  mapCarrierBillStatus,
  mapEquipment,
  mapInvoiceStatus,
  mapLoadStatus,
  normalizeBranch,
  normalizeDotNumber,
  normalizeMcNumber,
  parseAscendCsv,
  parseAscendDate,
  parseMoneyToCents,
  parseOptionalDate,
  parseStops,
  parseWeight,
  resolveStopAddress,
  type AscendLoadRow
} from "./lib/ascend-csv";
import { backfillFacilitiesForCompany } from "./backfill-facilities";

const prisma = new PrismaClient();

const COMPANY_NAME = "Talent Transport Logistics Inc";
const MAX_ASCEND_LOAD_ID = 2486;

const BRANCH_NAMES = [
  "Phillips Expedited",
  "Matt Boreako",
  "Corey Horvath",
  "Suki Hamzic",
  "Billy Parker",
  "Talent Transport Logistics"
] as const;

const COREY_BRANCH = "Corey Horvath";
const COREY_USER_NAME = "Corey Horvath";

type BranchContext = {
  branchId: string;
  userId: string;
};

type ImportSummary = {
  loadsCreated: number;
  loadsSkipped: number;
  customersCreated: number;
  carriersCreated: number;
  branchCreated: boolean;
  userCreated: boolean;
  warnings: string[];
};

function hashSeedPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function parseArgs() {
  const csvFlagIndex = process.argv.indexOf("--csv");
  if (csvFlagIndex === -1 || !process.argv[csvFlagIndex + 1]) {
    throw new Error('Usage: npx tsx prisma/ascend-load-import.ts --csv "path/to/file.csv"');
  }
  return { csvPath: process.argv[csvFlagIndex + 1] };
}

function emailForUser(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  return `${slug}@talenttransportlogistics.com`;
}

async function resolveCompany(): Promise<{ id: string; nextLoadSequence: number }> {
  const company = await prisma.company.findFirst({
    where: {
      OR: [{ name: COMPANY_NAME }, { slug: "talent-transport-logistics-inc" }]
    }
  });
  if (!company) {
    throw new Error(
      `Company not found: ${COMPANY_NAME}. Register or create the organization before running import.`
    );
  }
  return company;
}

async function resolveCommissionProfile(companyId: string) {
  const profile = await prisma.commissionProfile.findFirst({
    where: { companyId, isDefault: true },
    include: { rule: true }
  });
  if (!profile) {
    throw new Error("Default commission profile not found for company.");
  }
  return profile;
}

const TMS_BRANCH_ALIASES: Record<string, string[]> = {
  "Phillips Expedited": ["Phillips Expedited"],
  "Matt Boreako": ["Matt Boreako", "Matthew Boreako"],
  "Corey Horvath": ["Corey Horvath"],
  "Suki Hamzic": ["Suki Hamzic"],
  "Billy Parker": ["Billy Parker"],
  "Talent Transport Logistics": [
    "Talent Transport Logistics",
    "Talent Transport Logistics Inc HQ"
  ]
};

async function findBranch(companyId: string, canonicalBranch: string) {
  const aliases = TMS_BRANCH_ALIASES[canonicalBranch] ?? [canonicalBranch];
  for (const name of aliases) {
    const branch = await prisma.branch.findFirst({
      where: { companyId, name }
    });
    if (branch) {
      return branch;
    }
  }
  return null;
}

async function resolveBranchContext(
  companyId: string,
  branchName: string,
  commissionProfileId: string,
  summary: ImportSummary
): Promise<BranchContext> {
  let branch = await findBranch(companyId, branchName);

  if (!branch) {
    if (branchName !== COREY_BRANCH) {
      throw new Error(`Expected existing branch not found: ${branchName}`);
    }

    branch = await prisma.branch.create({
      data: {
        companyId,
        name: branchName,
        commissionProfileId
      }
    });
    summary.branchCreated = true;
  }

  let membership = await prisma.companyMembership.findFirst({
    where: {
      companyId,
      branchId: branch.id,
      status: "ACTIVE"
    },
    include: { user: true },
    orderBy: { createdAt: "asc" }
  });

  if (!membership) {
    if (branchName !== COREY_BRANCH) {
      throw new Error(`No active user linked to branch: ${branchName}`);
    }

    const user = await prisma.user.create({
      data: {
        name: COREY_USER_NAME,
        email: emailForUser(COREY_USER_NAME),
        passwordHash: hashSeedPassword("ChangeMe123!"),
        mustChangePassword: true
      }
    });

    membership = await prisma.companyMembership.create({
      data: {
        userId: user.id,
        companyId,
        branchId: branch.id,
        role: "BROKER",
        status: "ACTIVE",
        seatAssignedAt: new Date()
      },
      include: { user: true }
    });

    const subscription = await prisma.seatSubscription.findUnique({ where: { companyId } });
    if (subscription) {
      await prisma.seatSubscription.update({
        where: { companyId },
        data: { seatQuantity: subscription.seatQuantity + 1 }
      });
    }

    summary.userCreated = true;
  }

  return { branchId: branch.id, userId: membership.userId };
}

async function setupOrg(summary: ImportSummary) {
  const company = await resolveCompany();
  const profile = await resolveCommissionProfile(company.id);
  const branchContexts = new Map<string, BranchContext>();

  for (const branchName of BRANCH_NAMES) {
    const context = await resolveBranchContext(
      company.id,
      branchName,
      profile.id,
      summary
    );
    branchContexts.set(branchName, context);
  }

  if (company.nextLoadSequence < MAX_ASCEND_LOAD_ID) {
    await prisma.company.update({
      where: { id: company.id },
      data: { nextLoadSequence: MAX_ASCEND_LOAD_ID }
    });
  }

  return { company, branchContexts };
}

async function getOrCreateCustomer(
  companyId: string,
  branchId: string,
  name: string,
  cache: Map<string, string>,
  summary: ImportSummary
) {
  const key = name.trim().toLowerCase();
  if (!key) {
    throw new Error("Customer name is required.");
  }
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }

  const existing = await prisma.customer.findFirst({
    where: { companyId, name: name.trim() }
  });
  if (existing) {
    cache.set(key, existing.id);
    return existing.id;
  }

  const created = await prisma.customer.create({
    data: {
      companyId,
      branchId,
      name: name.trim(),
      status: "Active"
    }
  });
  cache.set(key, created.id);
  summary.customersCreated += 1;
  return created.id;
}

async function getOrCreateCarrier(
  companyId: string,
  branchId: string,
  row: AscendLoadRow,
  cache: Map<string, string>,
  summary: ImportSummary
) {
  const carrierName = row.Carrier?.trim();
  if (!carrierName) {
    return null;
  }

  const mc = normalizeMcNumber(row["Carrier MC Number"] ?? "");
  const dot = normalizeDotNumber(row["Carrier USDOT Number"] ?? "");
  const key = `${carrierName.toLowerCase()}|${mc ?? ""}|${dot ?? ""}`;
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }

  const existing = await prisma.carrier.findFirst({
    where: { companyId, name: carrierName }
  });
  if (existing) {
    cache.set(key, existing.id);
    return existing.id;
  }

  const created = await prisma.carrier.create({
    data: {
      companyId,
      branchId,
      name: carrierName,
      status: "Active",
      mcNumber: mc ?? undefined,
      mcNumberNormalized: mc?.replace(/[^A-Z0-9]/gi, "") ?? undefined,
      dotNumber: dot ?? undefined,
      dotNumberNormalized: dot?.replace(/[^A-Z0-9]/gi, "") ?? undefined,
      equipmentTypes: mapEquipment(row.Equipment ?? "")
    }
  });
  cache.set(key, created.id);
  summary.carriersCreated += 1;
  return created.id;
}

async function importLoad(
  row: AscendLoadRow,
  companyId: string,
  branchContexts: Map<string, BranchContext>,
  customerCache: Map<string, string>,
  carrierCache: Map<string, string>,
  summary: ImportSummary
) {
  const loadNumber = row["Load ID"]?.trim();
  if (!loadNumber) {
    summary.warnings.push("Skipped row with missing Load ID.");
    return;
  }

  const existing = await prisma.load.findFirst({
    where: { companyId, loadNumber }
  });
  if (existing) {
    summary.loadsSkipped += 1;
    return;
  }

  const branchName = assertKnownBranch(row.Branch ?? "");
  const branchContext = branchContexts.get(branchName);
  if (!branchContext) {
    throw new Error(`No branch context for ${branchName}`);
  }

  const pickupCity = row["First Pick City"]?.trim() || "Unknown";
  const pickupState = row["First Pick State"]?.trim() || "NA";
  const deliveryCity = row["Last Drop City"]?.trim() || "Unknown";
  const deliveryState = row["Last Drop State"]?.trim() || "NA";
  const pickupDate = parseAscendDate(row["First Pick Date"]);
  const deliveryDate = parseAscendDate(row["Last Drop Date"], pickupDate);
  const invoiceDate = parseOptionalDate(row["Invoice Dates"]);
  const invoiceSentDate = parseOptionalDate(row["Invoice Sent Date"]);
  const invoicePaymentDate = parseOptionalDate(row["Invoice Payment Dates"]);
  const billDate = parseOptionalDate(row["Bill Dates"]);
  const billPaymentDate = parseOptionalDate(row["Bill Payment Dates"]);
  const invoiceBalanceCents = parseMoneyToCents(row["Invoice Balance"]);
  const revenueCents = parseMoneyToCents(row["Total Income"]);
  const carrierCostCents = parseMoneyToCents(row["Total Expenses"]);
  const createdAt = parseAscendDate(row["Load Created Date"], new Date());
  const equipmentRaw = row.Equipment?.trim() ?? "";
  const equipmentType = mapEquipment(equipmentRaw);
  const status = mapLoadStatus({
    ascendStatus: row["Load Status"] ?? "",
    invoiceBalanceCents,
    invoicePaymentDate,
    invoiceDate
  });

  const customerId = await getOrCreateCustomer(
    companyId,
    branchContext.branchId,
    row.Customer ?? "Unknown Customer",
    customerCache,
    summary
  );
  const carrierId = await getOrCreateCarrier(
    companyId,
    branchContext.branchId,
    row,
    carrierCache,
    summary
  );

  const parsedStops = parseStops(row["All Stops & Actions"] ?? "");
  const stops = parsedStops.length > 0 ? parsedStops : fallbackStops(row);
  const stopCreates = stops.map((stop) => {
    const address = resolveStopAddress(stop, row);
    return {
      type: stop.type,
      sequence: stop.sequence,
      facilityName: address.facilityName,
      address: address.address,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      appointmentAt: stop.appointmentAt ?? (stop.type === "PICKUP" ? pickupDate : deliveryDate)
    };
  });

  const notes: { body: string; userId: string }[] = [];
  const publicNotes = row.Notes?.trim();
  const privateNotes = row["Private Notes"]?.trim();
  if (publicNotes) {
    notes.push({ body: publicNotes, userId: branchContext.userId });
  }
  if (privateNotes) {
    notes.push({ body: `[Private] ${privateNotes}`, userId: branchContext.userId });
  }
  if (equipmentRaw && equipmentRaw !== equipmentType) {
    notes.push({
      body: `[Ascend Equipment] ${equipmentRaw}`,
      userId: branchContext.userId
    });
  }

  const brokerAgent = extractBrokerAgent(row["Users & Roles"] ?? "");
  const activities = [
    {
      userId: branchContext.userId,
      action: "Load imported from Ascend",
      details: brokerAgent ? `BrokerAgent: ${brokerAgent}` : "Imported via Ascend CSV"
    }
  ];

  const load = await prisma.load.create({
    data: {
      companyId,
      branchId: branchContext.branchId,
      loadNumber,
      title: buildLoadTitle(pickupCity, pickupState, deliveryCity, deliveryState),
      status,
      customerId,
      referenceNumber: row.References?.trim() || undefined,
      equipmentType,
      commodity: row.Commodity?.trim() || undefined,
      weight: parseWeight(row.Weight),
      pickupCity,
      pickupState,
      deliveryCity,
      deliveryState,
      pickupDate,
      deliveryDate,
      revenueCents,
      carrierCostCents,
      createdAt,
      stops: { create: stopCreates },
      charges: {
        create: {
          label: "Linehaul",
          chargeType: "Linehaul",
          amountCents: revenueCents
        }
      },
      notes: notes.length ? { create: notes } : undefined,
      activities: { create: activities },
      dispatchAssignment: carrierId
        ? {
            create: {
              carrierId,
              driverName: row.Drivers?.trim() || undefined,
              truckNumber: row["Power Unit"]?.trim() || undefined,
              trailerNumber: row.Trailer?.trim() || undefined,
              rateCents: carrierCostCents,
              assignedAt: createdAt
            }
          }
        : undefined
    }
  });

  const invoiceStatus = mapInvoiceStatus({
    invoiceDate,
    invoiceSentDate,
    invoicePaymentDate,
    invoiceBalanceCents
  });
  if (invoiceStatus) {
    await prisma.invoice.create({
      data: {
        companyId,
        invoiceNo: `INV-${loadNumber}`,
        loadId: load.id,
        customerId,
        status: invoiceStatus,
        totalCents: revenueCents,
        issuedAt: invoiceDate ?? invoiceSentDate,
        paidAt: invoicePaymentDate ?? undefined
      }
    });
  }

  if (billDate && carrierId) {
    await prisma.carrierBill.create({
      data: {
        companyId,
        billNo: `BILL-${loadNumber}`,
        loadId: load.id,
        carrierId,
        status: mapCarrierBillStatus(billPaymentDate),
        totalCents: carrierCostCents,
        receivedAt: billDate,
        paidAt: billPaymentDate ?? undefined
      }
    });
  }

  await recalculateLoadCommission(load.id);
  summary.loadsCreated += 1;
}

async function main() {
  const { csvPath } = parseArgs();
  const rows = parseAscendCsv(csvPath);
  const summary: ImportSummary = {
    loadsCreated: 0,
    loadsSkipped: 0,
    customersCreated: 0,
    carriersCreated: 0,
    branchCreated: false,
    userCreated: false,
    warnings: []
  };

  const branchCounts = new Map<string, number>();
  for (const row of rows) {
    const branch = normalizeBranch(row.Branch ?? "");
    try {
      assertKnownBranch(branch);
      branchCounts.set(branch, (branchCounts.get(branch) ?? 0) + 1);
    } catch {
      summary.warnings.push(
        `Unknown branch on load ${row["Load ID"]}: "${row.Branch ?? ""}"`
      );
    }
  }

  const { company, branchContexts } = await setupOrg(summary);
  const customerCache = new Map<string, string>();
  const carrierCache = new Map<string, string>();

  for (const row of rows) {
    try {
      await importLoad(row, company.id, branchContexts, customerCache, carrierCache, summary);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      summary.warnings.push(`Load ${row["Load ID"]}: ${message}`);
    }
  }

  const facilityResult = await backfillFacilitiesForCompany(company.id);

  console.log("Ascend import complete");
  console.log(`CSV rows: ${rows.length}`);
  console.log(`Loads created: ${summary.loadsCreated}`);
  console.log(`Loads skipped (already exist): ${summary.loadsSkipped}`);
  console.log(`Customers created: ${summary.customersCreated}`);
  console.log(`Carriers created: ${summary.carriersCreated}`);
  console.log(`Corey branch created: ${summary.branchCreated}`);
  console.log(`Corey user created: ${summary.userCreated}`);
  console.log(`Facilities created: ${facilityResult.facilitiesCreated}`);
  console.log(`Stops linked to facilities: ${facilityResult.stopsLinked}`);
  console.log(`Unique facility locations: ${facilityResult.uniqueFacilities}`);
  console.log("Branch counts in CSV:");
  for (const [branch, count] of [...branchCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`  ${branch}: ${count}`);
  }
  if (summary.warnings.length) {
    console.log(`Warnings (${summary.warnings.length}):`);
    for (const warning of summary.warnings.slice(0, 25)) {
      console.log(`  - ${warning}`);
    }
    if (summary.warnings.length > 25) {
      console.log(`  ... and ${summary.warnings.length - 25} more`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
