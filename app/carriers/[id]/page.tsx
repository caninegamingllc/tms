import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import {
  createCarrierInsuranceCoverage,
  updateCarrier,
  updateCarrierInsuranceCoverage
} from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { insuranceCoverageTypes } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { formatDate, formatMoney, humanize } from "@/lib/format";

function dateInputValue(date?: Date | string | null) {
  if (!date) {
    return "";
  }

  return new Date(date).toISOString().slice(0, 10);
}

export default async function CarrierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const carrier = await prisma.carrier.findUnique({
    where: { id, companyId: user.companyId },
    include: {
      contacts: true,
      insuranceCoverages: { orderBy: [{ expiresAt: "asc" }, { coverageType: "asc" }] },
      complianceDocuments: true,
      assignments: { include: { load: true }, orderBy: { assignedAt: "desc" } }
    }
  });

  if (!carrier) {
    notFound();
  }

  const totalSpend = carrier.assignments.reduce((sum, assignment) => sum + assignment.rateCents, 0);

  return (
    <>
      <PageHeader
        title={carrier.name}
        description="Manage carrier authority, USDOT/MC information, compliance status, and insurance coverage expirations."
        action={
          <Link href="/carriers" className="btn-secondary">
            Back To Carriers
          </Link>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.2fr]">
        <section className="card">
          <h2 className="section-title">Carrier Profile</h2>
          <form action={updateCarrier} className="mt-4 grid gap-3">
            <input type="hidden" name="carrierId" value={carrier.id} />
            <input name="name" className="input" defaultValue={carrier.name} required />
            <div className="grid gap-3 md:grid-cols-2">
              <input name="mcNumber" className="input" defaultValue={carrier.mcNumber ?? ""} placeholder="MC number" />
              <input name="dotNumber" className="input" defaultValue={carrier.dotNumber ?? ""} placeholder="USDOT number" />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input name="phone" className="input" defaultValue={carrier.phone ?? ""} placeholder="Phone" />
              <input name="email" className="input" defaultValue={carrier.email ?? ""} placeholder="Email" type="email" />
            </div>
            <input name="equipmentTypes" className="input" defaultValue={carrier.equipmentTypes ?? ""} placeholder="Equipment types" />
            <div className="grid gap-3 md:grid-cols-2">
              <select name="status" className="select" defaultValue={carrier.status}>
                <option>Active</option>
                <option>Prospect</option>
                <option>Do Not Use</option>
                <option>Inactive</option>
              </select>
              <select name="complianceStatus" className="select" defaultValue={carrier.complianceStatus}>
                <option>Approved</option>
                <option>Needs Review</option>
                <option>Review Soon</option>
                <option>Blocked</option>
              </select>
            </div>
            <input name="safetyRating" className="input" defaultValue={carrier.safetyRating ?? ""} placeholder="Safety rating" />
            <button className="btn" type="submit">
              Save Carrier
            </button>
          </form>

          <div className="mt-6 grid gap-3 rounded-2xl bg-soft p-4 text-sm">
            <div>
              <p className="label">Insurance Summary</p>
              <p className="font-semibold text-ink">{formatDate(carrier.insuranceExpiresAt)}</p>
            </div>
            <div>
              <p className="label">Load History</p>
              <p className="font-semibold text-ink">
                {carrier.assignments.length} loads - {formatMoney(totalSpend)} spend
              </p>
            </div>
          </div>
        </section>

        <section className="card">
          <h2 className="section-title">Insurance Coverages</h2>
          <p className="muted">
            Track coverage type, insurer, policy number, limits, effective dates, and expiration dates.
          </p>

          <div className="mt-4 grid gap-4">
            {carrier.insuranceCoverages.map((coverage) => (
              <form
                key={coverage.id}
                action={updateCarrierInsuranceCoverage}
                className="grid gap-3 rounded-2xl border border-border p-4"
              >
                <input type="hidden" name="coverageId" value={coverage.id} />
                <div className="grid gap-3 md:grid-cols-3">
                  <select name="coverageType" className="select" defaultValue={coverage.coverageType}>
                    {insuranceCoverageTypes.map((type) => (
                      <option key={type} value={type}>
                        {humanize(type)}
                      </option>
                    ))}
                  </select>
                  <input name="insurerName" className="input" defaultValue={coverage.insurerName ?? ""} placeholder="Insurer" />
                  <select name="status" className="select" defaultValue={coverage.status}>
                    <option>Current</option>
                    <option>Expiring Soon</option>
                    <option>Expired</option>
                    <option>Missing</option>
                  </select>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <input name="policyNumber" className="input" defaultValue={coverage.policyNumber ?? ""} placeholder="Policy number" />
                  <input name="limitAmount" className="input" defaultValue={coverage.limitAmount ?? ""} placeholder="Limit" />
                  <input name="expiresAt" className="input" type="date" defaultValue={dateInputValue(coverage.expiresAt)} />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <input name="effectiveAt" className="input" type="date" defaultValue={dateInputValue(coverage.effectiveAt)} />
                  <input name="notes" className="input" defaultValue={coverage.notes ?? ""} placeholder="Notes" />
                </div>
                <button className="btn-secondary" type="submit">
                  Save Coverage
                </button>
              </form>
            ))}
          </div>

          <form action={createCarrierInsuranceCoverage} className="mt-5 grid gap-3 rounded-2xl bg-soft p-4">
            <input type="hidden" name="carrierId" value={carrier.id} />
            <p className="text-sm font-semibold text-ink">Add Coverage</p>
            <div className="grid gap-3 md:grid-cols-3">
              <select name="coverageType" className="select" defaultValue="AUTO_LIABILITY">
                {insuranceCoverageTypes.map((type) => (
                  <option key={type} value={type}>
                    {humanize(type)}
                  </option>
                ))}
              </select>
              <input name="insurerName" className="input" placeholder="Insurer" />
              <select name="status" className="select" defaultValue="Current">
                <option>Current</option>
                <option>Expiring Soon</option>
                <option>Expired</option>
                <option>Missing</option>
              </select>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <input name="policyNumber" className="input" placeholder="Policy number" />
              <input name="limitAmount" className="input" placeholder="Limit" />
              <input name="expiresAt" className="input" type="date" />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input name="effectiveAt" className="input" type="date" />
              <input name="notes" className="input" placeholder="Notes" />
            </div>
            <button className="btn" type="submit">
              Add Coverage
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
