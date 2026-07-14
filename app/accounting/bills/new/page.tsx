import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CarrierBillForm } from "@/components/carrier-bill-form";
import { PageHeader } from "@/components/page-header";
import { createCarrierBill } from "@/lib/actions";
import { buildDefaultCarrierBillForm } from "@/lib/carrier-bill-form";
import { resolveCarrierApPayee } from "@/lib/accounting-payee";
import { requireTmsAccess } from "@/lib/permissions";
import { canAccessRecord } from "@/lib/branch-filter-server";
import { prisma } from "@/lib/db";

export default async function NewCarrierBillPage({
  searchParams
}: {
  searchParams: Promise<{ loadId?: string }>;
}) {
  const user = await requireTmsAccess();
  const { loadId } = await searchParams;
  if (!loadId) {
    redirect("/accounting?tab=bills&error=" + encodeURIComponent("Select a load to record a bill."));
  }

  const load = await prisma.load.findUnique({
    where: { id: loadId, companyId: user.companyId },
    include: {
      dispatchAssignment: { include: { carrier: true } },
      carrierPayLines: {
        orderBy: { sortOrder: "asc" },
        include: { lineType: true }
      },
      carrierBills: true
    }
  });

  if (!load || !(await canAccessRecord(user, load.branchId))) {
    notFound();
  }

  const carrier = load.dispatchAssignment?.carrier;
  if (!carrier) {
    redirect(
      "/accounting?tab=bills&error=" +
        encodeURIComponent("Assign a carrier to the load before recording a bill.")
    );
  }

  const existing = load.carrierBills.find((bill) => bill.carrierId === carrier.id && bill.status !== "VOID");
  if (existing) {
    redirect(`/accounting/bills/${existing.id}`);
  }

  const payee = await resolveCarrierApPayee(carrier.id, user.companyId);
  const billCount = await prisma.carrierBill.count({ where: { companyId: user.companyId } });
  const suggestedBillNo = `CB-${String(billCount + 1001).padStart(4, "0")}`;

  const lineItems = load.carrierPayLines.map((line) => ({
    id: line.id,
    description: line.description || line.lineType.name,
    type: line.lineType.name,
    rateCents: line.unitRateCents,
    quantity: line.quantity,
    amountCents: line.amountCents
  }));

  if (lineItems.length === 0 && load.carrierCostCents > 0) {
    lineItems.push({
      id: "linehaul",
      description: "Linehaul",
      type: "Flat Rate",
      rateCents: load.carrierCostCents,
      quantity: 1,
      amountCents: load.carrierCostCents
    });
  }

  const initial = buildDefaultCarrierBillForm({
    loadId: load.id,
    loadNumber: load.loadNumber,
    carrierId: carrier.id,
    carrierName: carrier.name,
    paymentTerms: carrier.paymentTerms,
    paymentMethod: carrier.paymentMethod,
    payee,
    lineItems,
    suggestedBillNo
  });

  return (
    <>
      <PageHeader
        title="Record Carrier Bill"
        description={`Enter the received carrier invoice for load ${load.loadNumber}.`}
        action={
          <Link href="/accounting?tab=bills" className="btn-secondary">
            Back to Bill List
          </Link>
        }
      />

      <section className="card">
        <CarrierBillForm action={createCarrierBill} initial={initial} submitLabel="Save Bill" />
      </section>
    </>
  );
}
