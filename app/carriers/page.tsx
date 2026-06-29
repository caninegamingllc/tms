import { PageHeader } from "@/components/page-header";
import { createCarrier } from "@/lib/actions";
import { prisma } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";

export default async function CarriersPage() {
  const carriers = await prisma.carrier.findMany({
    orderBy: { name: "asc" },
    include: {
      contacts: true,
      complianceDocuments: true,
      assignments: { include: { load: true } }
    }
  });

  return (
    <>
      <PageHeader
        title="Carriers"
        description="Track carrier profiles, authority details, insurance, compliance documents, and carrier performance."
      />

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
                        <p className="font-semibold text-ink">{carrier.name}</p>
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
                      <td>{formatDate(carrier.insuranceExpiresAt)}</td>
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
          <form action={createCarrier} className="mt-4 grid gap-3">
            <input name="name" className="input" placeholder="Carrier name" required />
            <div className="grid gap-3 md:grid-cols-2">
              <input name="mcNumber" className="input" placeholder="MC number" />
              <input name="dotNumber" className="input" placeholder="DOT number" />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input name="phone" className="input" placeholder="Phone" />
              <input name="email" className="input" placeholder="Email" type="email" />
            </div>
            <input name="equipmentTypes" className="input" placeholder="Dry Van, Reefer, Flatbed" />
            <div className="grid gap-3 md:grid-cols-2">
              <select name="status" className="select" defaultValue="Active">
                <option>Active</option>
                <option>Prospect</option>
                <option>Do Not Use</option>
                <option>Inactive</option>
              </select>
              <select name="complianceStatus" className="select" defaultValue="Needs Review">
                <option>Approved</option>
                <option>Needs Review</option>
                <option>Review Soon</option>
                <option>Blocked</option>
              </select>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input name="safetyRating" className="input" placeholder="Safety rating" />
              <input name="insuranceExpiresAt" className="input" type="date" />
            </div>
            <div className="rounded-2xl bg-soft p-4">
              <p className="mb-3 text-sm font-semibold text-ink">Primary Dispatch Contact</p>
              <div className="grid gap-3">
                <input name="contactName" className="input" placeholder="Contact name" />
                <input name="contactTitle" className="input" placeholder="Title" />
                <input name="contactEmail" className="input" placeholder="Email" type="email" />
                <input name="contactPhone" className="input" placeholder="Phone" />
              </div>
            </div>
            <button className="btn" type="submit">
              Save Carrier
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
