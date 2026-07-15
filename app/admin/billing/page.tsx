import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { TileBoard, Tile } from "@/components/tile-board";
import {
  activateFreePlan,
  createBillingPortalSession,
  createPlanCheckoutSession,
  refreshSeatSubscriptionFromStripe
} from "@/lib/billing-actions";
import { requireAdmin } from "@/lib/auth";
import { formatPlanPrice, PLANS, type PlanId } from "@/lib/plans";
import { getSeatSummary } from "@/lib/seats";
import { isStripeConfigured } from "@/lib/stripe";
import { ADMIN_BILLING_TILES } from "@/lib/tile-defaults";
import { loadPageLayouts } from "@/lib/ui-preferences-load";

const PLAN_ORDER: PlanId[] = ["FREE", "LITE", "PREMIUM"];

function planHighlights(plan: PlanId): string[] {
  switch (plan) {
    case "FREE":
      return [
        "1 user only",
        "Basic load board (25 loads/month)",
        "Basic customers & carriers",
        "No documents, accounting, or email"
      ];
    case "LITE":
      return [
        "Up to 5 seats",
        "Dispatch, docs & invoice PDFs",
        "AR/AP + aging + factoring",
        "FMCSA lookup & QuickBooks IIF"
      ];
    case "PREMIUM":
      return [
        "Unlimited seats & branches",
        "Customer portal & mailbox email",
        "Commissions, QBO Online, maps",
        "Late fees, bulk workflows, audit log"
      ];
  }
}

export default async function BillingPage({
  searchParams
}: {
  searchParams: Promise<{
    welcome?: string;
    success?: string;
    canceled?: string;
    needsSeat?: string;
    error?: string;
  }>;
}) {
  const user = await requireAdmin();
  const params = await searchParams;
  await refreshSeatSubscriptionFromStripe(user.companyId, { force: params.success === "1" });
  const [seatSummary, layouts] = await Promise.all([
    getSeatSummary(user.companyId),
    loadPageLayouts("admin-billing")
  ]);
  const stripeReady = isStripeConfigured();
  const currentPlan = seatSummary.plan;

  return (
    <>
      <PageHeader
        title="Billing & Plans"
        description="Choose Free ($0), Lite ($20/mo), or Premium ($60/mo). Seat limits and features follow your plan."
      />

      {params.welcome === "1" ? (
        <div className="card mb-6 border-primary/20 bg-lightprimary text-sm text-primary">
          You are on the Free plan with one seat. Upgrade below when you need team seats, documents, or
          accounting. Dev promo: <strong>{process.env.STRIPE_DEV_PROMO_CODE ?? "DEV100"}</strong>
        </div>
      ) : null}

      {params.needsSeat === "1" ? (
        <div className="card mb-6 border-amber-200 bg-amber-50 text-sm text-amber-800">
          You need a seat assigned to access operational TMS features. Confirm your plan below, then assign
          seats in{" "}
          <Link href="/admin" className="font-semibold underline">
            Admin
          </Link>
          .
        </div>
      ) : null}

      {params.success === "1" ? (
        <div className="card mb-6 border-emerald-200 bg-emerald-50 text-sm text-emerald-800">
          Plan updated successfully.
        </div>
      ) : null}

      {params.canceled === "1" ? (
        <div className="card mb-6 border-slate-200 bg-slate-50 text-sm text-slate-700">
          Checkout was canceled.
        </div>
      ) : null}

      {params.error ? (
        <div className="card mb-6 border-rose-200 bg-rose-50 text-sm font-semibold text-rose-700">
          {params.error}
        </div>
      ) : null}

      <TileBoard pageId="admin-billing" tiles={ADMIN_BILLING_TILES} initialLayouts={layouts}>
        <Tile id="seat-summary">
          <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
            <div className="rounded-2xl bg-muted p-4">
              <p className="text-2xl font-bold text-foreground">{seatSummary.planName}</p>
              <p className="text-xs text-muted-foreground">Current plan</p>
            </div>
            <div className="rounded-2xl bg-muted p-4">
              <p className="text-2xl font-bold text-foreground">{seatSummary.purchased}</p>
              <p className="text-xs text-muted-foreground">Seats included</p>
            </div>
            <div className="rounded-2xl bg-muted p-4">
              <p className="text-2xl font-bold text-foreground">{seatSummary.assigned}</p>
              <p className="text-xs text-muted-foreground">Assigned</p>
            </div>
            <div className="rounded-2xl bg-muted p-4">
              <p className="text-2xl font-bold text-foreground">{seatSummary.available}</p>
              <p className="text-xs text-muted-foreground">Available</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Subscription status:{" "}
            <span className="font-semibold text-foreground">{seatSummary.subscriptionStatus}</span>
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Your seat status:{" "}
            <span className="font-semibold text-foreground">
              {user.hasSeat ? "Assigned" : "Not assigned"}
            </span>
          </p>
        </Tile>

        <Tile id="purchase">
          <p className="muted mb-4">
            Pick a plan for this organization. Seats are included with the plan and cannot be moved between
            organizations.
          </p>

          <div className="grid gap-4">
            {PLAN_ORDER.map((planId) => {
              const plan = PLANS[planId];
              const isCurrent = currentPlan === planId;
              return (
                <div
                  key={planId}
                  className={`rounded-2xl border p-4 ${
                    isCurrent ? "border-primary bg-lightprimary/40" : "border-border bg-card"
                  }`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
                    <p className="text-sm font-semibold text-foreground">
                      {formatPlanPrice(planId)}
                      {planId === "FREE" ? "" : "/mo"}
                    </p>
                  </div>
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {planHighlights(planId).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <p className="mt-4 text-sm font-semibold text-primary">Current plan</p>
                  ) : planId === "FREE" ? (
                    <form action={activateFreePlan} className="mt-4">
                      <button className="btn-secondary" type="submit">
                        Switch to Free
                      </button>
                    </form>
                  ) : !stripeReady ? (
                    <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      Stripe is not configured. Set STRIPE_SECRET_KEY, STRIPE_LITE_PRICE_ID, and
                      STRIPE_PREMIUM_PRICE_ID.
                    </p>
                  ) : (
                    <form action={createPlanCheckoutSession} className="mt-4 grid gap-3">
                      <input type="hidden" name="plan" value={planId} />
                      <label className="grid gap-2">
                        <span className="label">Promo code (optional)</span>
                        <input
                          name="promoCode"
                          className="input"
                          placeholder={process.env.STRIPE_DEV_PROMO_CODE ?? "DEV100"}
                        />
                      </label>
                      <button className="btn" type="submit">
                        Upgrade to {plan.name}
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>

          {stripeReady && seatSummary.plan !== "FREE" ? (
            <form action={createBillingPortalSession} className="mt-4">
              <button className="btn-secondary w-full" type="submit">
                Manage Subscription
              </button>
            </form>
          ) : null}
        </Tile>

        <Tile id="assign">
          <p className="muted">
            After upgrading, assign seats to team members in the{" "}
            <Link href="/admin" className="font-semibold text-primary underline">
              Admin console
            </Link>
            . Free includes one seat (the owner). Lite includes up to five. Premium is effectively unlimited.
          </p>
        </Tile>
      </TileBoard>
    </>
  );
}
