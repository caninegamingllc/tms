import { prisma } from "@/lib/db";
import { driverDisplayName, expirationBucket } from "@/lib/fleet-constants";
import { formatDate } from "@/lib/format";

export type ComplianceItem = {
  assetKind: "driver" | "truck" | "trailer" | "dqf";
  assetId: string;
  assetLabel: string;
  field: string;
  expiresAt: Date;
  bucket: "expired" | "30" | "60" | "90";
  href: string;
};

function pushIfExpiring(
  items: ComplianceItem[],
  input: {
    assetKind: ComplianceItem["assetKind"];
    assetId: string;
    assetLabel: string;
    field: string;
    expiresAt: Date | null | undefined;
    href: string;
  }
) {
  if (!input.expiresAt) return;
  const expiresAt = input.expiresAt;
  const bucket = expirationBucket(expiresAt);
  if (bucket === "ok" || bucket === "none") return;
  items.push({
    assetKind: input.assetKind,
    assetId: input.assetId,
    assetLabel: input.assetLabel,
    field: input.field,
    expiresAt,
    bucket,
    href: input.href
  });
}

export async function loadComplianceItems(companyId: string): Promise<ComplianceItem[]> {
  const [drivers, trucks, trailers, dqfItems] = await Promise.all([
    prisma.driver.findMany({
      where: { companyId, status: { not: "TERMINATED" } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
    }),
    prisma.truck.findMany({
      where: { companyId, status: { not: "INACTIVE" } },
      orderBy: { unitNumber: "asc" }
    }),
    prisma.trailer.findMany({
      where: { companyId, status: { not: "INACTIVE" } },
      orderBy: { unitNumber: "asc" }
    }),
    prisma.driverQualificationItem.findMany({
      where: { driver: { companyId }, expiresAt: { not: null } },
      include: { driver: true }
    })
  ]);

  const items: ComplianceItem[] = [];

  for (const driver of drivers) {
    const label = driverDisplayName(driver);
    const href = `/fleet/drivers/${driver.id}`;
    pushIfExpiring(items, {
      assetKind: "driver",
      assetId: driver.id,
      assetLabel: label,
      field: "CDL",
      expiresAt: driver.cdlExpiresAt,
      href
    });
    pushIfExpiring(items, {
      assetKind: "driver",
      assetId: driver.id,
      assetLabel: label,
      field: "Medical card",
      expiresAt: driver.medicalExpiresAt,
      href
    });
  }

  for (const truck of trucks) {
    const href = `/fleet/trucks/${truck.id}`;
    const label = `Tractor ${truck.unitNumber}`;
    pushIfExpiring(items, {
      assetKind: "truck",
      assetId: truck.id,
      assetLabel: label,
      field: "Registration",
      expiresAt: truck.registrationExpiresAt,
      href
    });
    pushIfExpiring(items, {
      assetKind: "truck",
      assetId: truck.id,
      assetLabel: label,
      field: "Annual inspection",
      expiresAt: truck.annualInspectionExpiresAt,
      href
    });
    pushIfExpiring(items, {
      assetKind: "truck",
      assetId: truck.id,
      assetLabel: label,
      field: "IRP / cab card",
      expiresAt: truck.irpExpiresAt,
      href
    });
    pushIfExpiring(items, {
      assetKind: "truck",
      assetId: truck.id,
      assetLabel: label,
      field: "Insurance",
      expiresAt: truck.insuranceExpiresAt,
      href
    });
  }

  for (const trailer of trailers) {
    const href = `/fleet/trailers/${trailer.id}`;
    const label = `Trailer ${trailer.unitNumber}`;
    pushIfExpiring(items, {
      assetKind: "trailer",
      assetId: trailer.id,
      assetLabel: label,
      field: "Registration",
      expiresAt: trailer.registrationExpiresAt,
      href
    });
    pushIfExpiring(items, {
      assetKind: "trailer",
      assetId: trailer.id,
      assetLabel: label,
      field: "Annual inspection",
      expiresAt: trailer.annualInspectionExpiresAt,
      href
    });
    pushIfExpiring(items, {
      assetKind: "trailer",
      assetId: trailer.id,
      assetLabel: label,
      field: "Insurance",
      expiresAt: trailer.insuranceExpiresAt,
      href
    });
  }

  for (const item of dqfItems) {
    pushIfExpiring(items, {
      assetKind: "dqf",
      assetId: item.id,
      assetLabel: `${driverDisplayName(item.driver)} — ${item.title}`,
      field: "DQF document",
      expiresAt: item.expiresAt,
      href: `/fleet/drivers/${item.driverId}`
    });
  }

  const order = { expired: 0, "30": 1, "60": 2, "90": 3 } as const;
  items.sort((a, b) => {
    const bucketDiff = order[a.bucket] - order[b.bucket];
    if (bucketDiff !== 0) return bucketDiff;
    return a.expiresAt.getTime() - b.expiresAt.getTime();
  });

  return items;
}

export function complianceBucketLabel(bucket: ComplianceItem["bucket"]) {
  switch (bucket) {
    case "expired":
      return "Expired";
    case "30":
      return "Within 30 days";
    case "60":
      return "Within 60 days";
    case "90":
      return "Within 90 days";
  }
}

export function formatComplianceExpiry(date: Date) {
  return formatDate(date);
}
