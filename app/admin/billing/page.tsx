import Link from "next/link";
import { SettingsLayout, SettingsSectionHeading } from "@/components/settings-layout";
import { TileBoard, Tile } from "@/components/tile-board";
import {
  activateFreePlan,
  createBillingPortalSession,
  createPlanCheckoutSession,
  refreshSeatSubscriptionFromStripe
} from "@/lib/billing-actions";
import { requireAdmin } from "@/lib/auth";
import { PLAN_ORDER, planHighlights } from "@/lib/plan-marketing";
import { formatPlanPrice, PLANS } from "@/lib/plans";
import { getSeatSummary } from "@/lib/seats";
import { getSettingsNavItems } from "@/lib/settings-nav";
import { isStripeConfigured } from "@/lib/stripe";
import { ADMIN_BILLING_TILES } from "@/lib/tile-defaults";
import { loadPageLayouts } from "@/lib/ui-preferences-load";

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
  const defaultQuantity = Math.max(1, seatSummary.purchased || 1);

  return (
    <SettingsLayout items={getSettingsNavItems(user)}>
      <SettingsSectionHeading
        title="Billing"
        description="Choose Free ($0), Lite ($20/seat/mo, max 5), Premium ($60/seat/mo), or Premium + Trucking ($100/seat/mo)."
      />

      {params.welcome === "1" ? (
        <div className="card mb-6 border-primary/20 bg-lightprimary text-sm text-primary">
          You are on the Free plan with one seat. Upgrade below and purchase seats when you need a team,
          documents, or accounting. Dev promo:{" "}
          <strong>{process.env.STRIPE_DEV_PROMO_CODE ?? "DEV100"}</strong>
        </div>
      ) : null}

      {params.needsSeat === "1" ? (
        <div className="card mb-6 border-amber-200 bg-amber-50 text-sm text-amber-800">
          You need a seat assigned to access operational TMS features. Confirm your plan and seat count
          below, then assign seats in{" "}
          <Link href="/admin" className="font-semibold underline">
            Admin
          </Link>
          .
        </div>
      ) : null}

      {params.success === "1" ? (
        <div className="card mb-6 border-emerald-200 bg-emerald-50 text-sm text-emerald-800">
          Plan and seats updated successfully.
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

      {currentPlan === "FREE" && params.welcome !== "1" ? (
        <div className="card mb-6 border-amber-200 bg-amber-50 text-sm text-amber-800">
          Free allows only one active user (usually the owner). Upgrade to <strong>Lite</strong> (buy up
          to 5 seats), <strong>Premium</strong>, or <strong>Premium + Trucking</strong> for teammates
          and fleet tools.
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
              <p className="text-xs text-muted-foreground">Seats purchased</p>
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
          {seatSummary.maxSeats != null ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Plan seat cap:{" "}
              <span className="font-semibold text-foreground">{seatSummary.maxSeats}</span>
            </p>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Plan seat cap: <span className="font-semibold text-foreground">No maximum</span>
            </p>
          )}
          <p className="mt-2 text-sm text-muted-foreground">
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
            Pick one plan for this organization. Everyone is billed on that plan&apos;s per-seat rate.
            Enter the <strong>total</strong> seats to purchase (not an add-on count). Seats cannot move
            between organizations.
          </p>

          <div className="grid gap-4">
            {PLAN_ORDER.map((planId) => {
              const plan = PLANS[planId];
              const isCurrent = currentPlan === planId;
              const seatDefault =
                planId === "LITE"
                  ? Math.min(5, defaultQuantity)
                  : defaultQuantity;

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
                      {planId === "FREE" ? "" : "/seat/mo"}
                    </p>
                  </div>
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {planHighlights(planId).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>

                  {planId === "FREE" ? (
                    isCurrent ? (
                      <p className="mt-4 text-sm font-semibold text-primary">Current plan</p>
                    ) : (
                      <form action={activateFreePlan} className="mt-4">
                        <button className="btn-secondary" type="submit">
                          Switch to Free
                        </button>
                      </form>
                    )
                  ) : !stripeReady ? (
                    <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      Stripe is not configured. Set STRIPE_SECRET_KEY, STRIPE_LITE_PRICE_ID,
                      STRIPE_PREMIUM_PRICE_ID, and STRIPE_PREMIUM_TRUCKING_PRICE_ID.
                    </p>
                  ) : (
                    <form action={createPlanCheckoutSession} className="mt-4 grid gap-3">
                      <input type="hidden" name="plan" value={planId} />
                      <label className="grid gap-2">
                        <span className="label">Total seats</span>
                        <input
                          name="quantity"
                          className="input"
                          type="number"
                          min={1}
                          max={planId === "LITE" ? 5 : undefined}
                          step={1}
                          defaultValue={seatDefault}
                          required
                        />
                      </label>
                      <p className="text-xs text-muted-foreground">
                        {planId === "LITE"
                          ? "Lite allows at most 5 seats for the organization."
                          : `${plan.name} has no seat maximum — purchase as many as you need.`}
                      </p>
                      {currentPlan === "FREE" ? (
                        <label className="grid gap-2">
                          <span className="label">Promo code (optional)</span>
                          <input
                            name="promoCode"
                            className="input"
                            placeholder={process.env.STRIPE_DEV_PROMO_CODE ?? "DEV100"}
                          />
                        </label>
                      ) : isCurrent ? (
                        <p className="text-xs text-muted-foreground">
                          Updates seat count on your current plan (prorated on your card on file).
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Switching plans opens Stripe Checkout so you can confirm payment for the
                          new rate.
                        </p>
                      )}
                      <button className="btn" type="submit">
                        {isCurrent
                          ? "Update seat quantity"
                          : `Switch to ${plan.name}`}
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
            After purchasing seats, assign them to team members in the{" "}
            <Link href="/admin" className="font-semibold text-primary underline">
              Admin console
            </Link>
            . Free allows one user. Lite is capped at five purchased seats. Premium and Premium +
            Trucking let you buy as many seats as you need.
          </p>
        </Tile>
      </TileBoard>
    </SettingsLayout>
  );
}
