import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function datasourceUrl() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    return undefined;
  }

  // Prefer a pooled URL for the app runtime when provided (PgBouncer / Neon pooler).
  const pooled = process.env.DATABASE_POOL_URL?.trim();
  return pooled || url;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: datasourceUrl(),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
