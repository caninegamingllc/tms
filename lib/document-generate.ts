import { randomBytes } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import {
  buildBillOfLading,
  buildBillOfLadingDocument,
  buildCustomerInvoice,
  buildCustomerInvoiceDocument,
  buildCustomerLoadConfirmation,
  buildCustomerLoadConfirmationDocument,
  buildRateConfirmation,
  buildRateConfirmationDocument,
  type CompanyBranding,
  type LoadForDocument,
  type StructuredDocument
} from "@/lib/document-templates";
import { getUploadDir } from "@/lib/document-storage";
import { generateDocumentPdf, pdfFilenameForDocument } from "@/lib/pdf-documents";

export async function getCompanyBranding(companyId: string): Promise<CompanyBranding> {
  return prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: {
      name: true,
      address: true,
      city: true,
      state: true,
      postalCode: true,
      phone: true,
      email: true,
      website: true,
      logoFilePath: true,
      logoMimeType: true
    }
  });
}

export function structuredDocumentForType(
  type: StructuredDocument["type"],
  load: LoadForDocument,
  documentNumber: string,
  company: CompanyBranding
) {
  switch (type) {
    case "RATE_CONFIRMATION":
      return buildRateConfirmationDocument(load, documentNumber, company);
    case "CUSTOMER_LOAD_CONFIRMATION":
      return buildCustomerLoadConfirmationDocument(load, documentNumber, company);
    case "BOL":
      return buildBillOfLadingDocument(load, documentNumber, company);
    case "INVOICE":
      return buildCustomerInvoiceDocument(load, documentNumber, company);
  }
}

export function plainTextForType(
  type: StructuredDocument["type"],
  load: LoadForDocument,
  documentNumber: string,
  company: CompanyBranding
) {
  switch (type) {
    case "RATE_CONFIRMATION":
      return buildRateConfirmation(load, documentNumber, company);
    case "CUSTOMER_LOAD_CONFIRMATION":
      return buildCustomerLoadConfirmation(load, documentNumber, company);
    case "BOL":
      return buildBillOfLading(load, documentNumber, company);
    case "INVOICE":
      return buildCustomerInvoice(load, documentNumber, company);
  }
}

export async function persistGeneratedPdf(
  companyId: string,
  structured: StructuredDocument
) {
  const pdfBuffer = await generateDocumentPdf(structured);
  const uploadDir = path.resolve(getUploadDir());
  const companyDir = path.join(uploadDir, companyId);
  await mkdir(companyDir, { recursive: true });

  const filename = `${randomBytes(8).toString("hex")}-${pdfFilenameForDocument(structured)}`;
  const storedPath = path.posix.join(companyId, filename);
  await writeFile(path.join(companyDir, filename), pdfBuffer);

  return {
    storedPath,
    mimeType: "application/pdf" as const,
    originalFileName: pdfFilenameForDocument(structured),
    fileSizeBytes: pdfBuffer.length,
    pdfBuffer
  };
}
