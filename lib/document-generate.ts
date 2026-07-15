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
import { saveBufferFile } from "@/lib/document-storage";
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

export async function persistGeneratedPdf(companyId: string, structured: StructuredDocument) {
  const pdfBuffer = await generateDocumentPdf(structured);
  const stored = await saveBufferFile(
    companyId,
    pdfFilenameForDocument(structured),
    pdfBuffer,
    "application/pdf"
  );

  return {
    ...stored,
    pdfBuffer
  };
}
