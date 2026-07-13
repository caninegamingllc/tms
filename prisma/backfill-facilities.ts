import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const COMPANY_NAME = "Talent Transport Logistics Inc";

function facilityKey(name: string, city: string, state: string, postalCode?: string | null) {
  return [name, city, state, postalCode ?? ""].join("|").toLowerCase();
}

export async function backfillFacilitiesForCompany(companyId: string) {
  const stops = await prisma.loadStop.findMany({
    where: { load: { companyId } },
    include: {
      load: {
        select: {
          customerId: true,
          branchId: true
        }
      }
    }
  });

  const cache = new Map<string, string>();
  let facilitiesCreated = 0;
  let stopsLinked = 0;

  for (const stop of stops) {
    const key = facilityKey(stop.facilityName, stop.city, stop.state, stop.postalCode);
    let facilityId = cache.get(key);

    if (!facilityId) {
      const existing = await prisma.facility.findFirst({
        where: {
          companyId,
          name: stop.facilityName,
          city: stop.city,
          state: stop.state
        }
      });

      if (existing) {
        facilityId = existing.id;
      } else {
        const created = await prisma.facility.create({
          data: {
            companyId,
            branchId: stop.load.branchId,
            customerId: stop.load.customerId,
            name: stop.facilityName,
            type: stop.type === "PICKUP" ? "SHIPPER" : "CONSIGNEE",
            address: stop.address,
            city: stop.city,
            state: stop.state,
            postalCode: stop.postalCode
          }
        });
        facilityId = created.id;
        facilitiesCreated += 1;
      }

      cache.set(key, facilityId);
    }

    if (stop.facilityId !== facilityId) {
      await prisma.loadStop.update({
        where: { id: stop.id },
        data: { facilityId }
      });
      stopsLinked += 1;
    }
  }

  return { facilitiesCreated, stopsLinked, uniqueFacilities: cache.size };
}

async function main() {
  const company = await prisma.company.findFirst({
    where: { name: COMPANY_NAME }
  });

  if (!company) {
    throw new Error(`Company not found: ${COMPANY_NAME}`);
  }

  const result = await backfillFacilitiesForCompany(company.id);
  console.log("Facility backfill complete");
  console.log(`Facilities created: ${result.facilitiesCreated}`);
  console.log(`Stops linked: ${result.stopsLinked}`);
  console.log(`Unique facilities: ${result.uniqueFacilities}`);
}

const isDirectRun = process.argv[1]?.replace(/\\/g, "/").includes("backfill-facilities");

if (isDirectRun) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
