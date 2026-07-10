"use client";

import { useTransition } from "react";
import { switchOrganization } from "@/lib/membership-actions";
import type { OrganizationSummary } from "@/lib/types";

export function OrgSwitcher({
  organizations,
  currentMembershipId
}: {
  organizations: OrganizationSummary[];
  currentMembershipId: string;
}) {
  const [isPending, startTransition] = useTransition();

  if (organizations.length <= 1) {
    return null;
  }

  return (
    <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Organization
      </p>
      <select
        className="select mt-2 w-full"
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
