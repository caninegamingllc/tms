import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CarrierBillForm } from "@/components/carrier-bill-form";
import { PageHeader } from "@/components/page-header";
import { createCarrierBill } from "@/lib/actions";
import { buildDefaultCarrierBillForm } from "@/lib/carrier-bill-form";
import { resolveCarrierApPayee } from "@/lib/accounting-payee";
import { primaryAssignment } from "@/lib/dispatch-assignment";
import { requirePlanFeature } from "@/lib/permissions";
import { canAccessRecord } from "@/lib/branch-filter-server";
import { prisma } from "@/lib/db";

export default async function NewCarrierBillPage({
  searchParams
}: {
  searchParams: Promise<{ loadId?: string; carrierId?: string }>;
}) {
  const user = await requirePlanFeature("accounting_ar_ap");
  const { loadId, carrierId: carrierIdParam } = await searchParams;
  if (!loadId) {
    redirect("/accounting?tab=bills&error=" + encodeURIComponent("Select a load to record a bill."));
  }

  const load = await prisma.load.findUnique({
    where: { id: loadId, companyId: user.companyId },
    include: {
      dispatchAssignments: {
        orderBy: { sequence: "asc" },
        include: {
          carrier: true,
          payLines: {
            orderBy: { sortOrder: "asc" },
            include: { lineType: true }
          }
        }
      },
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

  const withCarrier = load.dispatchAssignments.filter((row) => row.carrierId && row.carrier);
  const assignment =
    (carrierIdParam
      ? withCarrier.find((row) => row.carrierId === carrierIdParam)
      : null) ??
    primaryAssignment(withCarrier) ??
    withCarrier[0] ??
    null;

  const carrier = assignment?.carrier ?? null;
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

  const assignmentPayLines =
    assignment.payLines.length > 0
      ? assignment.payLines
      : load.carrierPayLines.filter(
          (line) =>
            line.assignmentId === assignment.id ||
            (line.assignmentId == null && assignment.sequence === 0)
        );

  const lineItems = assignmentPayLines.map((line) => ({
    id: line.id,
    description: line.description || line.lineType.name,
    type: line.lineType.name,
    rateCents: line.unitRateCents,
    quantity: line.quantity,
    amountCents: line.amountCents
  }));

  if (lineItems.length === 0 && assignment.rateCents > 0) {
    lineItems.push({
      id: "linehaul",
      description: "Linehaul",
      type: "Flat Rate",
      rateCents: assignment.rateCents,
      quantity: 1,
      amountCents: assignment.rateCents
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
