import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentUploadForm } from "@/components/document-upload-form";
import { DocumentsTable } from "@/components/documents-table";
import { PageHeader } from "@/components/page-header";
import { TileBoard, Tile } from "@/components/tile-board";
import {
  addCarrierActivityNote,
  createCarrierInsuranceCoverage,
  updateCarrier,
  updateCarrierInsuranceCoverage
} from "@/lib/actions";
import { requireTmsAccess, userHasPlanFeature } from "@/lib/permissions";
import { canWrite } from "@/lib/scope";
import { insuranceCoverageTypes } from "@/lib/constants";
import { toDocumentTableRows } from "@/lib/document-rows";
import { prisma } from "@/lib/db";
import { formatDate, formatDateTime, formatMoney, humanize } from "@/lib/format";
import { CARRIER_DETAIL_TILES } from "@/lib/tile-defaults";
import { loadPageLayouts } from "@/lib/ui-preferences-load";

function dateInputValue(date?: Date | string | null) {
  if (!date) {
    return "";
  }

  return new Date(date).toISOString().slice(0, 10);
}

export default async function CarrierDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { id } = await params;
  const { error, saved } = await searchParams;
  const user = await requireTmsAccess();
  const canCrmDocs = userHasPlanFeature(user, "crm_documents_activity");
  const carrierTiles = CARRIER_DETAIL_TILES.filter((tile) => {
    if (tile.id === "activity" || tile.id === "documents") return canCrmDocs;
    return true;
  });
  const [carrier, layouts] = await Promise.all([
    prisma.carrier.findUnique({
      where: { id, companyId: user.companyId },
      include: {
        contacts: true,
        factoringCompany: true,
        insuranceCoverages: { orderBy: [{ expiresAt: "asc" }, { coverageType: "asc" }] },
        documents: { include: { uploadedBy: true, load: true, customer: true, carrier: true } },
        assignments: { include: { load: true }, orderBy: { assignedAt: "desc" } },
        activities: { orderBy: { createdAt: "desc" }, include: { user: true } }
      }
    }),
    loadPageLayouts("carrier-detail")
  ]);

  if (!carrier) {
    notFound();
  }

  const factoringCompanies = await prisma.factoringCompany.findMany({
    where: { companyId: user.companyId, status: "Active" },
    orderBy: { name: "asc" }
  });

  const totalSpend = carrier.assignments.reduce((sum, assignment) => sum + assignment.rateCents, 0);
  const writable = canWrite(user);

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

      {error ? (
        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}

      {saved ? (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          Carrier saved successfully.
        </div>
      ) : null}

      <TileBoard pageId="carrier-detail" tiles={carrierTiles} initialLayouts={layouts}>
        <Tile id="profile">
          {writable ? (
            <form action={updateCarrier} className="grid gap-3">
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
              <input name="address" className="input" defaultValue={carrier.address ?? ""} placeholder="Address" />
              <div className="grid gap-3 md:grid-cols-3">
                <input name="city" className="input" defaultValue={carrier.city ?? ""} placeholder="City" />
                <input
                  name="state"
                  className="input"
                  defaultValue={carrier.state ?? ""}
                  placeholder="State"
                  maxLength={2}
                />
                <input name="postalCode" className="input" defaultValue={carrier.postalCode ?? ""} placeholder="Zip" />
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
              <div className="rounded-2xl border border-border p-4">
                <p className="mb-3 text-sm font-semibold text-foreground">Payment & Factoring</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    name="paymentTerms"
                    className="input"
                    defaultValue={carrier.paymentTerms}
                    placeholder="Payment terms (e.g. Net 30)"
                  />
                  <input
                    name="paymentMethod"
                    className="input"
                    defaultValue={carrier.paymentMethod ?? ""}
                    placeholder="Payment method"
                  />
                </div>
                <select
                  name="factoringCompanyId"
                  className="select mt-3"
                  defaultValue={carrier.factoringCompanyId ?? ""}
                >
                  <option value="">Pay carrier directly (no factor)</option>
                  {factoringCompanies.map((factor) => (
                    <option key={factor.id} value={factor.id}>
                      {factor.name} — check: {factor.nameOnCheck}
                    </option>
                  ))}
                </select>
                {carrier.factoringCompany ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Payee for QuickBooks: {carrier.factoringCompany.name} · Print on check:{" "}
                    {carrier.factoringCompany.nameOnCheck}
                  </p>
                ) : null}
              </div>
              <button className="btn" type="submit">
                Save Carrier
              </button>
            </form>
          ) : (
            <div className="grid gap-3 rounded-2xl bg-muted p-4 text-sm">
              <div>
                <p className="label">Authority</p>
                <p className="font-semibold text-foreground">
                  MC {carrier.mcNumber ?? "—"} · USDOT {carrier.dotNumber ?? "—"}
                </p>
              </div>
              <div>
                <p className="label">Status</p>
                <p className="font-semibold text-foreground">
                  {carrier.status} · {carrier.complianceStatus}
                </p>
              </div>
              <div>
                <p className="label">Contact</p>
                <p className="font-semibold text-foreground">{carrier.phone ?? "No phone"}</p>
                <p className="muted">{carrier.email ?? "No email"}</p>
              </div>
            </div>
          )}

          <div className="mt-6 grid gap-3 rounded-2xl bg-muted p-4 text-sm">
            <div>
              <p className="label">Insurance Summary</p>
              <p className="font-semibold text-foreground">{formatDate(carrier.insuranceExpiresAt)}</p>
            </div>
            <div>
              <p className="label">Load History</p>
              <p className="font-semibold text-foreground">
                {carrier.assignments.length} loads - {formatMoney(totalSpend)} spend
              </p>
            </div>
          </div>
        </Tile>

        {canCrmDocs ? (
        <Tile id="activity">
          {writable ? (
            <form action={addCarrierActivityNote} className="grid gap-3 rounded-2xl bg-muted p-4">
              <input type="hidden" name="carrierId" value={carrier.id} />
              <textarea
                name="body"
                className="textarea"
                rows={3}
                placeholder="Add a note to the activity log…"
                required
              />
              <button type="submit" className="btn-secondary">
                Save Activity Note
              </button>
            </form>
          ) : null}
          <div className={writable ? "mt-4 grid gap-3" : "grid gap-3"}>
            {carrier.activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              carrier.activities.map((activity) => (
                <div key={activity.id} className="rounded-2xl border border-border p-3">
                  <p className="font-semibold text-foreground">{activity.action}</p>
                  <p className="muted whitespace-pre-wrap">{activity.details ?? "No details"}</p>
                  <p className="text-xs text-muted-foreground">
                    {activity.user?.name ? `${activity.user.name} · ` : ""}
                    {formatDateTime(activity.createdAt)}
                  </p>
                </div>
              ))
            )}
          </div>
        </Tile>
        ) : null}

        <Tile id="insurance">
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

          <form action={createCarrierInsuranceCoverage} className="mt-5 grid gap-3 rounded-2xl bg-muted p-4">
            <input type="hidden" name="carrierId" value={carrier.id} />
            <p className="text-sm font-semibold text-foreground">Add Coverage</p>
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
        </Tile>

        {canCrmDocs ? (
        <Tile id="documents">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <p className="muted">
              Upload and manage W-9s, insurance certificates, broker contracts, and other carrier paperwork.
            </p>
            <Link href="/documents/new" className="btn-secondary">
              Upload in document library
            </Link>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-border">
            <DocumentsTable
              documents={toDocumentTableRows(carrier.documents)}
              showFilter={false}
              compact
            />
          </div>

          <div className="mt-5 rounded-2xl bg-muted p-4">
            <p className="mb-3 text-sm font-semibold text-foreground">Upload Carrier Document</p>
            <DocumentUploadForm
              defaultCarrierId={carrier.id}
              showEntityPickers={false}
              submitLabel="Add Document"
            />
          </div>
        </Tile>
        ) : null}
      </TileBoard>
    </>
  );
}
