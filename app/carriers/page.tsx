import Link from "next/link";
import { CarrierLookupForm } from "@/components/carrier-lookup-form";
import { PageHeader } from "@/components/page-header";
import { createCarrier } from "@/lib/actions";
import { requireTmsAccess } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";

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
            <p className="muted">Compliance status helps dispatchers avoid risky assignments.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Carrier</th>
                  <th>Authority</th>
                  <th>Equipment</th>
                  <th>Compliance</th>
                  <th>Insurance</th>
                  <th>Load History</th>
                </tr>
              </thead>
              <tbody>
                {carriers.map((carrier) => {
                  const totalSpend = carrier.assignments.reduce(
                    (sum, assignment) => sum + assignment.rateCents,
                    0
                  );

                  return (
                    <tr key={carrier.id}>
                      <td>
                        <Link href={`/carriers/${carrier.id}`} className="font-semibold text-brand-700">
                          {carrier.name}
                        </Link>
                        <p className="muted">{carrier.email ?? carrier.phone ?? "No contact info"}</p>
                      </td>
                      <td>
                        <p>{carrier.mcNumber ?? "MC missing"}</p>
                        <p className="muted">{carrier.dotNumber ?? "DOT missing"}</p>
                      </td>
                      <td>{carrier.equipmentTypes ?? "Not specified"}</td>
                      <td>
                        <p className="font-semibold">{carrier.complianceStatus}</p>
                        <p className="muted">{carrier.safetyRating ?? "No rating"}</p>
                      </td>
                      <td>
                        <p>{formatDate(carrier.insuranceExpiresAt)}</p>
                        <p className="muted">{carrier.insuranceCoverages.length} coverages</p>
                      </td>
                      <td>
                        <p>{carrier.assignments.length} loads</p>
                        <p className="muted">{formatMoney(totalSpend)} spend</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
