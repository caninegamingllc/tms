import Link from "next/link";
import { CarrierLookupForm } from "@/components/carrier-lookup-form";
import { CarriersTable } from "@/components/carriers-table";
import { PageHeader } from "@/components/page-header";
import { createCarrier } from "@/lib/actions";
import { requireTmsAccess } from "@/lib/permissions";
import { prisma } from "@/lib/db";

export default async function CarriersPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const user = await requireTmsAccess();
  const carriers = await prisma.carrier.findMany({
    where: { companyId: user.companyId },
    orderBy: { name: "asc" },
    include: {
      contacts: true,
      complianceDocuments: true,
      insuranceCoverages: true,
      assignments: { include: { load: true } }
    }
  });

  const rows = carriers.map((carrier) => {
    const totalSpend = carrier.assignments.reduce((sum, assignment) => sum + assignment.rateCents, 0);

    return {
      id: carrier.id,
      name: carrier.name,
      contact: carrier.email ?? carrier.phone ?? "No contact info",
      mcNumber: carrier.mcNumber ?? "MC missing",
      dotNumber: carrier.dotNumber ?? "DOT missing",
      equipmentTypes: carrier.equipmentTypes ?? "Not specified",
      complianceStatus: carrier.complianceStatus,
      safetyRating: carrier.safetyRating ?? "No rating",
      insuranceExpiresAt: carrier.insuranceExpiresAt?.toISOString() ?? null,
      coverageCount: carrier.insuranceCoverages.length,
      loadCount: carrier.assignments.length,
      totalSpendCents: totalSpend
    };
  });

  return (
    <>
      <PageHeader
        title="Carriers"
        description="Track carrier profiles, authority details, insurance, compliance documents, and carrier performance."
      />

      {error ? (
        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.8fr]">
        <section className="card overflow-hidden p-0">
          <div className="border-b border-border p-5">
            <h2 className="section-title">Carrier Network</h2>
            <p className="muted">Compliance status helps dispatchers avoid risky assignments. Click column headers to sort.</p>
          </div>
          <div className="overflow-x-auto">
            <CarriersTable carriers={rows} />
          </div>
        </section>

        <section className="card">
          <h2 className="section-title">Add Carrier</h2>
          <CarrierLookupForm action={createCarrier} />
        </section>
      </div>
    </>
  );
}
