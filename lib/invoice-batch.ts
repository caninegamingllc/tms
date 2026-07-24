/** Max invoices (loads) attached to a single batch email. */
export const INVOICE_BATCH_EMAIL_MAX = 5;

export type InvoiceBatchReviewLine = {
  loadId: string;
  loadNumber: string;
  invoiceNo: string;
  totalCents: number;
  referenceNumber: string | null;
  deliveryAt: string | null;
};

export type InvoiceBatchCustomerGroup = {
  customerId: string;
  customerName: string;
  fromAddress: string;
  to: string;
  subject: string;
  body: string;
  emailCount: number;
  lines: InvoiceBatchReviewLine[];
};

export type InvoiceBatchReview = {
  groups: InvoiceBatchCustomerGroup[];
};
