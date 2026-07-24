import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  defaultCarrierPayLineTypes,
  defaultCommodityNames,
  defaultCustomerChargeTypes,
  defaultDriverPayLineTypes
} from "@/lib/constants";

type CatalogDb = PrismaClient | Prisma.TransactionClient;

export async function seedCompanyCatalogs(companyId: string, db: CatalogDb) {
  await db.commodityOption.createMany({
    data: defaultCommodityNames.map((name, index) => ({
      companyId,
      name,
      active: true,
      sortOrder: index
    }))
  });

  await db.carrierPayLineType.createMany({
    data: defaultCarrierPayLineTypes.map((type, index) => ({
      companyId,
      name: type.name,
      calculationMethod: type.calculationMethod,
      isSystem: type.isSystem,
      active: true,
      sortOrder: index
    }))
  });

  await db.driverPayLineType.createMany({
    data: defaultDriverPayLineTypes.map((type, index) => ({
      companyId,
      name: type.name,
      calculationMethod: type.calculationMethod,
      isSystem: type.isSystem,
      active: true,
      sortOrder: index
    }))
  });

  await db.customerChargeType.createMany({
    data: defaultCustomerChargeTypes.map((type, index) => ({
      companyId,
      name: type.name,
      calculationMethod: type.calculationMethod,
      isSystem: type.isSystem,
      includeInDriverPay: type.includeInDriverPay,
      active: true,
      sortOrder: index
    }))
  });
}

/** Seeds default commodities and line-type catalogs when a company has none yet. */
export async function ensureCompanyCatalogs(companyId: string, db: CatalogDb = prisma) {
  const [commodityCount, payTypeCount, driverPayTypeCount, chargeTypeCount] = await Promise.all([
    db.commodityOption.count({ where: { companyId } }),
    db.carrierPayLineType.count({ where: { companyId } }),
    db.driverPayLineType.count({ where: { companyId } }),
    db.customerChargeType.count({ where: { companyId } })
  ]);

  if (commodityCount === 0) {
    await db.commodityOption.createMany({
      data: defaultCommodityNames.map((name, index) => ({
        companyId,
        name,
        active: true,
        sortOrder: index
      }))
    });
  }

  if (payTypeCount === 0) {
    await db.carrierPayLineType.createMany({
      data: defaultCarrierPayLineTypes.map((type, index) => ({
        companyId,
        name: type.name,
        calculationMethod: type.calculationMethod,
        isSystem: type.isSystem,
        active: true,
        sortOrder: index
      }))
    });
  }

  if (driverPayTypeCount === 0) {
    await db.driverPayLineType.createMany({
      data: defaultDriverPayLineTypes.map((type, index) => ({
        companyId,
        name: type.name,
        calculationMethod: type.calculationMethod,
        isSystem: type.isSystem,
        active: true,
        sortOrder: index
      }))
    });
  }

  if (chargeTypeCount === 0) {
    await db.customerChargeType.createMany({
      data: defaultCustomerChargeTypes.map((type, index) => ({
        companyId,
        name: type.name,
        calculationMethod: type.calculationMethod,
        isSystem: type.isSystem,
        includeInDriverPay: type.includeInDriverPay,
        active: true,
        sortOrder: index
      }))
    });
  } else {
    // Ensure system exclude types exist for older companies
    for (const type of defaultCustomerChargeTypes.filter((t) => !t.includeInDriverPay)) {
      const existing = await db.customerChargeType.findFirst({
        where: { companyId, name: type.name }
      });
      if (!existing) {
        await db.customerChargeType.create({
          data: {
            companyId,
            name: type.name,
            calculationMethod: type.calculationMethod,
            isSystem: type.isSystem,
            includeInDriverPay: false,
            active: true,
            sortOrder: 100
          }
        });
      }
    }
  }
}
