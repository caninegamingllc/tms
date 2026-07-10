import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import {
  createBillingPortalSession,
  createSeatCheckoutSession,
  refreshSeatSubscriptionFromStripe
} from "@/lib/billing-actions";
import { requireAdmin } from "@/lib/auth";
import { getSeatSummary } from "@/lib/seats";
import { isStripeConfigured } from "@/lib/stripe";

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
  const seatSummary = await getSeatSummary(user.companyId);
  const stripeReady = isStripeConfigured();

  return (
    <>
      <PageHeader
        title="Billing & Seats"
        description="Purchase seats for your organization. Seats are $25/seat/month and cannot be transferred between organizations."
      />

      {params.welcome === "1" ? (
        <div className="card mb-6 border-primary/20 bg-lightprimary text-sm text-primary">
          Welcome! Purchase at least one seat to start using the TMS. Use promo code{" "}
          <strong>{process.env.STRIPE_DEV_PROMO_CODE ?? "DEV100"}</strong> for 100% off during development.
        </div>
      ) : null}

      {params.needsSeat === "1" ? (
        <div className="card mb-6 border-amber-200 bg-amber-50 text-sm text-amber-800">
          You need a seat assigned to access operational TMS features. Purchase seats below, then assign yourself
          a seat in <Link href="/admin" className="font-semibold underline">Admin</Link>.
        </div>
      ) : null}

      {params.success === "1" ? (
        <div className="card mb-6 border-emerald-200 bg-emerald-50 text-sm text-emerald-800">
          Payment successful. Your seat subscription has been updated.
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

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="section-title">Seat Summary</h2>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl bg-muted p-4">
              <p className="text-2xl font-bold text-foreground">{seatSummary.purchased}</p>
              <p className="text-xs text-muted-foreground">Purchased</p>
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
            Subscription status: <span className="font-semibold text-foreground">{seatSummary.subscriptionStatus}</span>
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Your seat status:{" "}
            <span className="font-semibold text-foreground">{user.hasSeat ? "Assigned" : "Not assigned"}</span>
          </p>
        </section>

        <section className="card">
          <h2 className="section-title">Purchase Seats</h2>
          <p className="muted">$25 per seat per month. Seats belong to this organization only.</p>

          {!stripeReady ? (
            <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_SEAT_PRICE_ID in your environment.
            </p>
          ) : (
            <form action={createSeatCheckoutSession} className="mt-4 grid gap-3">
              <label className="grid gap-2">
                <span className="label">Number of seats</span>
                <input name="quantity" className="input" type="number" min={1} defaultValue={1} required />
              </label>
              <label className="grid gap-2">
                <span className="label">Promo code (optional)</span>
                <input
                  name="promoCode"
                  className="input"
                  placeholder={process.env.STRIPE_DEV_PROMO_CODE ?? "DEV100"}
                />
              </label>
              <button className="btn" type="submit">
                Checkout with Stripe
              </button>
            </form>
          )}

          {stripeReady && seatSummary.purchased > 0 ? (
            <form action={createBillingPortalSession} className="mt-3">
              <button className="btn-secondary w-full" type="submit">
                Manage Subscription
              </button>
            </form>
          ) : null}
        </section>
      </div>

      <section className="card mt-6">
        <h2 className="section-title">Assign Seats</h2>
        <p className="muted">
          After purchasing seats, assign them to team members in the{" "}
          <Link href="/admin" className="font-semibold text-primary underline">
            Admin console
          </Link>
          .
        </p>
      </section>
    </>
  );
}
