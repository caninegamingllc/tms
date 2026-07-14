"use client";

import { useTransition } from "react";
import { clsx } from "clsx";
import { switchOrganization } from "@/lib/membership-actions";
import type { OrganizationSummary } from "@/lib/types";

export function OrgSwitcher({
  organizations,
  currentMembershipId,
  compact = false
}: {
  organizations: OrganizationSummary[];
  currentMembershipId: string;
  compact?: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  if (organizations.length <= 1) {
    return null;
  }

  return (
    <div
      className={clsx(
        compact
          ? "min-w-[160px]"
          : "mt-4 rounded-md border border-border bg-muted/30 p-3"
      )}
    >
      {!compact ? (
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Organization
        </p>
      ) : null}
      <select
        className={clsx("select", compact ? "h-8 py-1 text-[12px]" : "mt-2 w-full")}
        aria-label="Organization"
        value={currentMembershipId}
        disabled={isPending}
        onChange={(event) => {
          const membershipId = event.target.value;
          if (membershipId === currentMembershipId) {
            return;
          }

          const formData = new FormData();
          formData.set("membershipId", membershipId);
          startTransition(() => switchOrganization(formData));
        }}
      >
        {organizations.map((org) => (
          <option key={org.membershipId} value={org.membershipId}>
            {org.companyName} ({org.role}){org.hasSeat ? "" : " — No seat"}
          </option>
        ))}
      </select>
    </div>
  );
}
