import Link from "next/link";
import { notFound } from "next/navigation";
import { DriverForm } from "@/components/fleet-forms";
import { DqfSection } from "@/components/dqf-section";
import { PageHeader } from "@/components/page-header";
import { ensureDqfChecklist } from "@/lib/dqf-actions";
import { updateDriverCsaScores } from "@/lib/dvir-settlement-actions";
import { updateDriver } from "@/lib/fleet-actions";
import { driverDisplayName } from "@/lib/fleet-constants";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { requirePlanFeature } from "@/lib/permissions";
import { planHasFeature } from "@/lib/plans";

export default async function FleetDriverDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const user = await requirePlanFeature("fleet_assets");
  const { id } = await params;
  const query = await searchParams;

  const driver = await prisma.driver.findFirst({
    where: { id, companyId: user.companyId },
    include: {
      qualificationItems: { orderBy: [{ category: "asc" }, { createdAt: "asc" }] },
      safetyEvents: { orderBy: { occurredAt: "desc" }, take: 5 }
    }
  });
  if (!driver) notFound();

  const canDqf = planHasFeature(user.plan, "driver_qualification");
  if (canDqf) {
    await ensureDqfChecklist(driver.id, user.companyId);
  }

  const qualificationItems = canDqf
    ? await prisma.driverQualificationItem.findMany({
        where: { driverId: driver.id },
        orderBy: [{ category: "asc" }, { createdAt: "asc" }]
      })
    : [];

  return (
    <>
      <PageHeader
        title={driverDisplayName(driver)}
        description="Driver profile, credentials, CSA scores, and qualification file."
      />
      <p className="mb-4 text-sm">
        <Link href="/fleet/drivers" className="font-semibold text-primary underline">
          ← Drivers
        </Link>
      </p>
      {query.saved ? (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          Saved.
        </div>
      ) : null}

      <div className="card">
        <h2 className="mb-4 text-lg font-semibold">Profile</h2>
        <DriverForm action={updateDriver} driver={driver} />
      </div>

      <div className="card mt-6">
        <h2 className="mb-2 text-lg font-semibold">CSA / HOS</h2>
        <p className="muted mb-4">
          BASIC percentile scores (optional). Enter manually or paste from CSA. HOS summary updates
          when you sync an ELD provider.
        </p>
        {driver.hosLastSyncedAt ? (
          <p className="mb-3 text-sm text-muted-foreground">
            HOS last synced {formatDateTime(driver.hosLastSyncedAt)}
            {driver.hosStatusSummary ? ` — ${driver.hosStatusSummary}` : ""}
          </p>
        ) : null}
        <form action={updateDriverCsaScores} className="grid gap-3 sm:grid-cols-3">
          <input type="hidden" name="driverId" value={driver.id} />
          {(
            [
              ["csaUnsafeDriving", "Unsafe driving", driver.csaUnsafeDriving],
              ["csaHosCompliance", "HOS compliance", driver.csaHosCompliance],
              ["csaVehicleMaint", "Vehicle maintenance", driver.csaVehicleMaint],
              ["csaControlledSub", "Controlled substances", driver.csaControlledSub],
              ["csaDriverFitness", "Driver fitness", driver.csaDriverFitness],
              ["csaCrashIndicator", "Crash indicator", driver.csaCrashIndicator]
            ] as const
          ).map(([name, label, value]) => (
            <label key={name} className="grid gap-1">
              <span className="label">{label}</span>
              <input
                className="input"
                name={name}
                type="number"
                step="0.1"
                min={0}
                max={100}
                defaultValue={value ?? ""}
                placeholder="0–100"
              />
            </label>
          ))}
          <label className="grid gap-1 sm:col-span-3">
            <span className="label">HOS status summary</span>
            <textarea
              className="input min-h-[70px]"
              name="hosStatusSummary"
              defaultValue={driver.hosStatusSummary ?? ""}
            />
          </label>
          <div className="sm:col-span-3">
            <button className="btn" type="submit">
              Save CSA / HOS
            </button>
          </div>
        </form>
      </div>

      {canDqf ? <DqfSection driverId={driver.id} items={qualificationItems} /> : null}

      {planHasFeature(user.plan, "safety_records") && driver.safetyEvents.length > 0 ? (
        <div className="card mt-6">
          <h2 className="mb-3 text-lg font-semibold">Recent safety events</h2>
          <ul className="space-y-2 text-sm">
            {driver.safetyEvents.map((event) => (
              <li key={event.id} className="border-b border-border/60 pb-2">
                <span className="font-semibold">{event.eventType}</span> — {event.description}
              </li>
            ))}
          </ul>
          <Link
            href="/fleet/safety"
            className="mt-3 inline-block text-sm font-semibold text-primary underline"
          >
            Open safety register
          </Link>
        </div>
      ) : null}
    </>
  );
}
