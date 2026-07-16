import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import {
  complianceBucketLabel,
  formatComplianceExpiry,
  loadComplianceItems
} from "@/lib/fleet-compliance";
import { requirePlanFeature } from "@/lib/permissions";

export default async function FleetCompliancePage() {
  const user = await requirePlanFeature("fleet_assets");
  const items = await loadComplianceItems(user.companyId);

  const groups = {
    expired: items.filter((i) => i.bucket === "expired"),
    "30": items.filter((i) => i.bucket === "30"),
    "60": items.filter((i) => i.bucket === "60"),
    "90": items.filter((i) => i.bucket === "90")
  } as const;

  return (
    <>
      <PageHeader
        title="Compliance"
        description="Credentials and equipment expirations across drivers, trucks, trailers, and DQF documents (next 90 days)."
      />

      {items.length === 0 ? (
        <div className="card">
          <p className="muted">Nothing expiring in the next 90 days. Keep dates updated on each asset.</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {(Object.keys(groups) as Array<keyof typeof groups>).map((bucket) => {
            const list = groups[bucket];
            if (list.length === 0) return null;
            return (
              <div key={bucket} className="card">
                <h2 className="mb-4 text-lg font-semibold">{complianceBucketLabel(bucket)}</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="py-2 pr-3">Asset</th>
                        <th className="py-2 pr-3">Item</th>
                        <th className="py-2">Expires</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((item) => (
                        <tr key={`${item.assetKind}-${item.assetId}-${item.field}`} className="border-b border-border/60">
                          <td className="py-2.5 pr-3">
                            <Link href={item.href} className="font-semibold text-primary underline">
                              {item.assetLabel}
                            </Link>
                          </td>
                          <td className="py-2.5 pr-3">{item.field}</td>
                          <td className="py-2.5">{formatComplianceExpiry(item.expiresAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
