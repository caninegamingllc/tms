import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import {
  type AccountingExportEntityType,
  type AccountingExportMethod,
  type ExportStatusView,
  type QuickbooksMethod,
  exportedLabel,
  methodLabel,
  notExportedLabel
} from "@/lib/quickbooks/types";

export async function getCompanyQuickbooksMethod(companyId: string): Promise<QuickbooksMethod> {
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { quickbooksMethod: true }
  });
  const method = company.quickbooksMethod;
  if (method === "ONLINE" || method === "IIF" || method === "NONE") {
    return method;
  }
  return "NONE";
}

export async function upsertAccountingExport(input: {
  companyId: string;
  entityType: AccountingExportEntityType;
  entityId: string;
  method: AccountingExportMethod;
  status: "SYNCED" | "ERROR";
  externalId?: string | null;
  message?: string | null;
  exportedByUserId?: string | null;
}) {
  const exportedAt = input.status === "SYNCED" ? new Date() : undefined;

  return prisma.accountingExport.upsert({
    where: {
      entityType_entityId_method: {
        entityType: input.entityType,
        entityId: input.entityId,
        method: input.method
      }
    },
    create: {
      companyId: input.companyId,
      entityType: input.entityType,
      entityId: input.entityId,
      method: input.method,
      status: input.status,
      exportedAt: exportedAt ?? null,
      externalId: input.externalId ?? null,
      message: input.message ?? null,
      exportedByUserId: input.exportedByUserId ?? null
    },
    update: {
      status: input.status,
      exportedAt: exportedAt === undefined ? undefined : exportedAt,
      externalId: input.externalId === undefined ? undefined : input.externalId,
      message: input.message ?? null,
      exportedByUserId: input.exportedByUserId ?? null
    }
  });
}

export async function getExportsForEntities(input: {
  companyId: string;
  method: AccountingExportMethod;
  entityType: AccountingExportEntityType;
  entityIds: string[];
}) {
  if (input.entityIds.length === 0) {
    return new Map<string, Awaited<ReturnType<typeof prisma.accountingExport.findMany>>[number]>();
  }

  const rows = await prisma.accountingExport.findMany({
    where: {
      companyId: input.companyId,
      method: input.method,
      entityType: input.entityType,
      entityId: { in: input.entityIds }
    }
  });

  return new Map(rows.map((row) => [row.entityId, row]));
}

export function toExportStatusView(
  method: AccountingExportMethod,
  exportRow: {
    status: string;
    exportedAt: Date | null;
    message: string | null;
  } | null
): ExportStatusView {
  const exported = Boolean(exportRow && exportRow.status === "SYNCED" && exportRow.exportedAt);
  const exportedAt = exportRow?.exportedAt?.toISOString() ?? null;

  if (exported && exportRow?.exportedAt) {
    return {
      method,
      methodLabel: methodLabel(method),
      exported: true,
      exportedAt,
      status: exportRow.status,
      message: exportRow.message,
      label: exportedLabel(method, formatDate(exportRow.exportedAt))
    };
  }

  if (exportRow?.status === "ERROR") {
    return {
      method,
      methodLabel: methodLabel(method),
      exported: false,
      exportedAt: null,
      status: "ERROR",
      message: exportRow.message,
      label: `${notExportedLabel(method)}${exportRow.message ? `: ${exportRow.message}` : ""}`
    };
  }

  return {
    method,
    methodLabel: methodLabel(method),
    exported: false,
    exportedAt: null,
    status: null,
    message: null,
    label: notExportedLabel(method)
  };
}
