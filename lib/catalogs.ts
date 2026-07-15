import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  defaultCarrierPayLineTypes,
  defaultCommodityNames,
  defaultCustomerChargeTypes
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

  await db.customerChargeType.createMany({
    data: defaultCustomerChargeTypes.map((type, index) => ({
      companyId,
      name: type.name,
      calculationMethod: type.calculationMethod,
      isSystem: type.isSystem,
      active: true,
      sortOrder: index
    }))
  });
}

/** Seeds default commodities and line-type catalogs when a company has none yet. */
export async function ensureCompanyCatalogs(companyId: string, db: CatalogDb = prisma) {
  const [commodityCount, payTypeCount, chargeTypeCount] = await Promise.all([
    db.commodityOption.count({ where: { companyId } }),
    db.carrierPayLineType.count({ where: { companyId } }),
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

  if (chargeTypeCount === 0) {
    await db.customerChargeType.createMany({
      data: defaultCustomerChargeTypes.map((type, index) => ({
        companyId,
        name: type.name,
        calculationMethod: type.calculationMethod,
        isSystem: type.isSystem,
        active: true,
        sortOrder: index
      }))
    });
  }
}
