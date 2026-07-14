import Link from "next/link";
import { notFound } from "next/navigation";
import { CarrierBillForm } from "@/components/carrier-bill-form";
import { PageHeader } from "@/components/page-header";
import { updateCarrierBill } from "@/lib/actions";
import { buildDefaultCarrierBillForm } from "@/lib/carrier-bill-form";
import { resolveCarrierApPayee } from "@/lib/accounting-payee";
import { requireTmsAccess } from "@/lib/permissions";
import { canAccessRecord } from "@/lib/branch-filter-server";
import { prisma } from "@/lib/db";

export default async function EditCarrierBillPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireTmsAccess();
  const { id } = await params;

  const bill = await prisma.carrierBill.findUnique({
    where: { id, companyId: user.companyId },
    include: {
      carrier: true,
      load: {
        include: {
          carrierPayLines: {
            orderBy: { sortOrder: "asc" },
            include: { lineType: true }
          }
        }
      }
    }
  });

  if (!bill || !(await canAccessRecord(user, bill.load.branchId))) {
    notFound();
  }

  const payee = await resolveCarrierApPayee(bill.carrierId, user.companyId);
  const lineItems = bill.load.carrierPayLines.map((line) => ({
    id: line.id,
    description: line.description || line.lineType.name,
    type: line.lineType.name,
    rateCents: line.unitRateCents,
    quantity: line.quantity,
    amountCents: line.amountCents
  }));

  if (lineItems.length === 0 && bill.totalCents > 0) {
    lineItems.push({
      id: "billed",
      description: "Carrier invoice total",
      type: "Bill",
      rateCents: bill.totalCents,
      quantity: 1,
      amountCents: bill.totalCents
    });
  }

  const initial = buildDefaultCarrierBillForm({
    bill,
    loadId: bill.loadId,
    loadNumber: bill.load.loadNumber,
    carrierId: bill.carrierId,
    carrierName: bill.carrier.name,
    paymentTerms: bill.carrier.paymentTerms,
    paymentMethod: bill.carrier.paymentMethod,
    payee,
    lineItems,
    suggestedBillNo: bill.billNo
  });

  const readOnly = bill.status === "PAID" || bill.status === "VOID";

  return (
    <>
      <PageHeader
        title={readOnly ? "View Carrier Bill" : "Edit Carrier Bill"}
        description={`${bill.billNo} · Load ${bill.load.loadNumber} · ${bill.carrier.name}`}
        action={
          <Link href="/accounting?tab=bills" className="btn-secondary">
            Back to Bill List
          </Link>
        }
      />

      <section className="card">
        {readOnly ? (
          <p className="mb-4 text-sm font-semibold text-amber-800">
            This bill is {bill.status.toLowerCase()} and cannot be edited.
          </p>
        ) : null}
        {readOnly ? (
          <div className="grid gap-3 text-sm">
            <p>
              <span className="label">Checks Payable To</span>
              <span className="block font-semibold">{bill.nameOnCheck ?? bill.payeeName}</span>
            </p>
            <p>
              <span className="label">Remit To</span>
              <span className="block whitespace-pre-wrap font-semibold">{bill.remitAddress ?? "—"}</span>
            </p>
            <p>
              <span className="label">Bill Reference</span>
              <span className="block font-semibold">{bill.billReference ?? "—"}</span>
            </p>
            <p>
              <span className="label">Amount / Balance</span>
              <span className="block font-semibold">
                ${(bill.totalCents / 100).toFixed(2)} · ${(bill.balanceCents / 100).toFixed(2)} open
              </span>
            </p>
          </div>
        ) : (
          <CarrierBillForm action={updateCarrierBill} initial={initial} submitLabel="Save Bill" />
        )}
      </section>
    </>
  );
}
