import { cache } from "react";
import { redirect } from "next/navigation";
import {
  planHasFeature,
  upgradePathMessage,
  type PlanFeature
} from "@/lib/plans";
import { canAccessAdmin, canAccessTms, getCompanyPlan } from "@/lib/seats";
import { canWrite } from "@/lib/scope";

export { canWrite, canManageUsers } from "@/lib/scope";

function redirectIfNoSeat(user: { hasSeat: boolean; role: string }) {
  if (!canAccessTms({ seatAssignedAt: user.hasSeat ? new Date() : null })) {
    if (canAccessAdmin(user.role)) {
      redirect("/admin/billing?needsSeat=1");
    }

    redirect("/select-organization?error=You%20need%20a%20seat%20assigned%20to%20access%20this%20organization");
  }
}

function redirectIfMissingFeature(
  user: { plan: string; role: string },
  feature: PlanFeature
): void {
  if (planHasFeature(user.plan, feature)) {
    return;
  }

  const message = upgradePathMessage(feature, user.plan as import("@/lib/plans").PlanId);
  if (canAccessAdmin(user.role)) {
    redirect(`/admin/billing?error=${encodeURIComponent(message)}`);
  }

  redirect(`/?error=${encodeURIComponent(message)}`);
}

export async function requireWriteUser() {
  const { requireUser } = await import("@/lib/auth");
  const user = await requireUser();

  if (!canWrite(user)) {
    redirect("/?error=You%20do%20not%20have%20permission%20to%20modify%20data");
  }

  redirectIfNoSeat(user);

  return user;
}

export const requireTmsAccess = cache(async () => {
  const { requireUser } = await import("@/lib/auth");
  const user = await requireUser();

  redirectIfNoSeat(user);

  return user;
});

export async function requirePlanFeature(feature: PlanFeature) {
  const user = await requireTmsAccess();
  redirectIfMissingFeature(user, feature);
  return user;
}

export async function requireWritePlanFeature(feature: PlanFeature) {
  const user = await requireWriteUser();
  redirectIfMissingFeature(user, feature);
  return user;
}

export async function assertPlanFeature(companyId: string, feature: PlanFeature) {
  const plan = await getCompanyPlan(companyId);
  if (!planHasFeature(plan, feature)) {
    throw new Error(upgradePathMessage(feature, plan));
  }
  return plan;
}

export function userHasPlanFeature(
  user: { plan: string },
  feature: PlanFeature
): boolean {
  return planHasFeature(user.plan, feature);
}
