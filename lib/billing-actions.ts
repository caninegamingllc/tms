"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type Stripe from "stripe";
import { resolvePublicAppUrl } from "@/lib/app-url";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { includedSeatQuantity, isPlanId, type PlanId } from "@/lib/plans";
import { autoAssignOwnerOnPurchase, pruneSeatsToQuantity } from "@/lib/seats";
import {
  getPlanPriceId,
  getStripe,
  isStripeConfigured,
  resolvePlanFromStripePrice
} from "@/lib/stripe";

async function publicBillingBaseUrl() {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const proto = headerStore.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${proto}://${host}` : null;
  return resolvePublicAppUrl(origin);
}

function redirectBillingError(message: string): never {
  redirect(`/admin/billing?error=${encodeURIComponent(message)}`);
}

async function ensureStripeCustomer(
  companyId: string,
  actor: { email: string; name: string },
  existingCustomerId: string | null | undefined
) {
  if (existingCustomerId) {
    return existingCustomerId;
  }

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: actor.email,
    name: actor.name,
    metadata: { companyId }
  });

  await prisma.seatSubscription.upsert({
    where: { companyId },
    create: {
      companyId,
      stripeCustomerId: customer.id,
      plan: "FREE",
      status: "ACTIVE",
      seatQuantity: 1
    },
    update: { stripeCustomerId: customer.id }
  });

  return customer.id;
}

async function applyPromoToCheckout(
  sessionParams: Stripe.Checkout.SessionCreateParams,
  promoCode: string
) {
  if (promoCode) {
    const promoCodes = await getStripe().promotionCodes.list({
      code: promoCode,
      active: true,
      limit: 1
    });

    if (promoCodes.data[0]) {
      sessionParams.discounts = [{ promotion_code: promoCodes.data[0].id }];
      return;
    }

    redirectBillingError("Invalid promo code");
  }

  const baseUrl = await publicBillingBaseUrl();
  const allowDevPromo =
    process.env.NODE_ENV !== "production" || /localhost|127\.0\.0\.1/i.test(baseUrl);

  if (!allowDevPromo || !process.env.STRIPE_DEV_PROMO_CODE) {
    return;
  }

  try {
    const promoCodes = await getStripe().promotionCodes.list({
      code: process.env.STRIPE_DEV_PROMO_CODE,
      active: true,
      limit: 1
    });

    if (promoCodes.data[0]) {
      sessionParams.discounts = [{ promotion_code: promoCodes.data[0].id }];
    }
  } catch {
    // Promo lookup is optional during development.
  }
}

export async function createPlanCheckoutSession(formData: FormData) {
  const actor = await requireAdmin();

  if (!isStripeConfigured()) {
    redirectBillingError("Stripe is not configured");
  }

  const planRaw = String(formData.get("plan") ?? "").trim().toUpperCase();
  const promoCode = String(formData.get("promoCode") ?? "").trim();

  if (planRaw !== "LITE" && planRaw !== "PREMIUM") {
    redirectBillingError("Choose the Lite or Premium plan");
  }

  const plan = planRaw as Exclude<PlanId, "FREE">;

  try {
    const stripe = getStripe();
    const priceId = getPlanPriceId(plan);
    const baseUrl = await publicBillingBaseUrl();

    let subscription = await prisma.seatSubscription.findUnique({
      where: { companyId: actor.companyId }
    });

    if (!subscription) {
      subscription = await prisma.seatSubscription.create({
        data: {
          companyId: actor.companyId,
          plan: "FREE",
          status: "ACTIVE",
          seatQuantity: 1
        }
      });
    }

    const customerId = await ensureStripeCustomer(
      actor.companyId,
      actor,
      subscription.stripeCustomerId
    );

    if (subscription.stripeSubscriptionId) {
      try {
        const existing = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId, {
          expand: ["items.data.price"]
        });

        if (existing.status === "active" || existing.status === "trialing" || existing.status === "past_due") {
          const item = existing.items.data[0];
          if (!item) {
            redirectBillingError("Existing subscription has no billable items");
          }

          if (promoCode) {
            redirectBillingError(
              "Promo codes apply to new checkouts only. Change plans without a promo, or manage billing in the portal."
            );
          }

          const updated = await stripe.subscriptions.update(existing.id, {
            items: [
              {
                id: item.id,
                price: priceId,
                quantity: 1
              }
            ],
            proration_behavior: "create_prorations",
            metadata: { companyId: actor.companyId, plan }
          });

          await syncSeatSubscriptionFromStripe(updated, actor.companyId);
          await autoAssignOwnerOnPurchase(actor.companyId, actor.membershipId);
          redirect("/admin/billing?success=1");
        }
      } catch (error) {
        if (error && typeof error === "object" && "digest" in error) {
          throw error;
        }
        // Stale subscription id — fall through to a fresh checkout.
      }
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/admin/billing?success=1`,
      cancel_url: `${baseUrl}/admin/billing?canceled=1`,
      metadata: {
        companyId: actor.companyId,
        membershipId: actor.membershipId,
        plan
      },
      subscription_data: {
        metadata: { companyId: actor.companyId, plan }
      }
    };

    await applyPromoToCheckout(sessionParams, promoCode);

    const session = await stripe.checkout.sessions.create(sessionParams);

    if (!session.url) {
      redirectBillingError("Failed to create checkout session");
    }

    redirect(session.url);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Checkout failed";
    redirectBillingError(message);
  }
}

/** @deprecated Use createPlanCheckoutSession — kept so old forms do not crash. */
export async function createSeatCheckoutSession(formData: FormData) {
  const quantity = Number(formData.get("quantity"));
  if (Number.isInteger(quantity) && quantity > 5) {
    formData.set("plan", "PREMIUM");
  } else {
    formData.set("plan", "LITE");
  }
  await createPlanCheckoutSession(formData);
}

export async function activateFreePlan() {
  const actor = await requireAdmin();

  const subscription = await prisma.seatSubscription.findUnique({
    where: { companyId: actor.companyId }
  });

  if (subscription?.stripeSubscriptionId && subscription.status === "ACTIVE") {
    redirectBillingError(
      "Cancel your paid subscription in Manage Subscription before switching to Free."
    );
  }

  await prisma.seatSubscription.upsert({
    where: { companyId: actor.companyId },
    create: {
      companyId: actor.companyId,
      plan: "FREE",
      status: "ACTIVE",
      seatQuantity: 1
    },
    update: {
      plan: "FREE",
      status: "ACTIVE",
      seatQuantity: 1,
      stripeSubscriptionId: null,
      stripePriceId: null,
      currentPeriodEnd: null
    }
  });

  await pruneSeatsToQuantity(actor.companyId, 1);
  await autoAssignOwnerOnPurchase(actor.companyId, actor.membershipId);
  redirect("/admin/billing?success=1");
}

export async function createBillingPortalSession() {
  const actor = await requireAdmin();

  if (!isStripeConfigured()) {
    redirectBillingError("Stripe is not configured");
  }

  const subscription = await prisma.seatSubscription.findUnique({
    where: { companyId: actor.companyId }
  });

  if (!subscription?.stripeCustomerId) {
    redirectBillingError("No billing account found");
  }

  try {
    const stripe = getStripe();
    const baseUrl = await publicBillingBaseUrl();
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${baseUrl}/admin/billing`
    });

    redirect(portalSession.url);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Billing portal failed";
    redirectBillingError(message);
  }
}

export async function syncSeatSubscriptionFromStripe(
  subscription: Stripe.Subscription,
  companyIdOverride?: string
) {
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? null;

  let companyId: string | null = companyIdOverride ?? subscription.metadata?.companyId ?? null;

  if (!companyId && customerId) {
    const match = await prisma.seatSubscription.findFirst({
      where: { stripeCustomerId: customerId },
      select: { companyId: true }
    });
    companyId = match?.companyId ?? null;
  }

  if (!companyId) {
    const match = await prisma.seatSubscription.findFirst({
      where: { stripeSubscriptionId: subscription.id },
      select: { companyId: true }
    });
    companyId = match?.companyId ?? null;
  }

  if (!companyId) {
    return;
  }

  const firstItem = subscription.items.data[0];
  const price = firstItem?.price;
  const priceId = typeof price === "string" ? price : price?.id ?? null;
  const quantity = firstItem?.quantity ?? 0;
  const periodEndSeconds =
    (subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end ??
    (firstItem as { current_period_end?: number } | undefined)?.current_period_end;
  const currentPeriodEnd = periodEndSeconds ? new Date(periodEndSeconds * 1000) : null;

  const statusMap: Record<string, string> = {
    active: "ACTIVE",
    past_due: "PAST_DUE",
    canceled: "CANCELED",
    unpaid: "PAST_DUE",
    incomplete: "NONE",
    incomplete_expired: "CANCELED",
    trialing: "ACTIVE",
    paused: "PAST_DUE"
  };

  const mappedStatus = statusMap[subscription.status] ?? "NONE";
  const metadataPlan = subscription.metadata?.plan;
  const resolved =
    mappedStatus === "CANCELED" || mappedStatus === "NONE"
      ? { plan: "FREE" as PlanId, seatQuantity: 1 }
      : isPlanId(metadataPlan)
        ? { plan: metadataPlan, seatQuantity: includedSeatQuantity(metadataPlan) }
        : resolvePlanFromStripePrice(priceId, quantity);

  await prisma.seatSubscription.upsert({
    where: { companyId },
    create: {
      companyId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      plan: resolved.plan,
      seatQuantity: resolved.seatQuantity,
      status: mappedStatus === "NONE" ? "ACTIVE" : mappedStatus,
      currentPeriodEnd
    },
    update: {
      stripeCustomerId: customerId ?? undefined,
      stripeSubscriptionId:
        mappedStatus === "CANCELED" ? null : subscription.id,
      stripePriceId: mappedStatus === "CANCELED" ? null : priceId,
      plan: resolved.plan,
      seatQuantity: resolved.seatQuantity,
      status: mappedStatus === "CANCELED" || mappedStatus === "NONE" ? "ACTIVE" : mappedStatus,
      currentPeriodEnd: mappedStatus === "CANCELED" ? null : currentPeriodEnd
    }
  });

  await pruneSeatsToQuantity(companyId, resolved.seatQuantity);

  const ownerMembership = await prisma.companyMembership.findFirst({
    where: { companyId, role: "OWNER", status: "ACTIVE" },
    orderBy: { createdAt: "asc" }
  });

  if (ownerMembership) {
    await autoAssignOwnerOnPurchase(companyId, ownerMembership.id);
  }
}

export async function syncSeatSubscriptionForCompany(companyId: string) {
  if (!isStripeConfigured()) {
    return false;
  }

  const local = await prisma.seatSubscription.findUnique({
    where: { companyId }
  });

  if (!local?.stripeCustomerId && !local?.stripeSubscriptionId) {
    return false;
  }

  const stripe = getStripe();
  let subscription: Stripe.Subscription | null = null;

  if (local.stripeSubscriptionId) {
    try {
      subscription = await stripe.subscriptions.retrieve(local.stripeSubscriptionId, {
        expand: ["items.data.price"]
      });

      if (
        subscription.status === "canceled" ||
        subscription.status === "incomplete_expired" ||
        subscription.status === "unpaid"
      ) {
        subscription = null;
      }
    } catch {
      // Subscription id may be stale after a new checkout.
    }
  }

  if (!subscription && local.stripeCustomerId) {
    const subscriptions = await stripe.subscriptions.list({
      customer: local.stripeCustomerId,
      status: "all",
      limit: 20,
      expand: ["data.items.data.price"]
    });

    const activeSubscriptions = subscriptions.data.filter(
      (item) => item.status === "active" || item.status === "trialing"
    );

    subscription =
      activeSubscriptions.sort((left, right) => {
        const leftQty = left.items.data[0]?.quantity ?? 0;
        const rightQty = right.items.data[0]?.quantity ?? 0;
        if (rightQty !== leftQty) {
          return rightQty - leftQty;
        }
        return right.created - left.created;
      })[0] ??
      subscriptions.data.sort((left, right) => right.created - left.created)[0] ??
      null;
  }

  if (!subscription) {
    return false;
  }

  await syncSeatSubscriptionFromStripe(subscription, companyId);
  return true;
}

export async function refreshSeatSubscriptionFromStripe(
  companyId: string,
  options?: { force?: boolean }
) {
  if (!isStripeConfigured()) {
    return;
  }

  const local = await prisma.seatSubscription.findUnique({
    where: { companyId }
  });

  if (!local?.stripeCustomerId && !local?.stripeSubscriptionId) {
    return;
  }

  if (!options?.force) {
    const assigned = await prisma.companyMembership.count({
      where: { companyId, seatAssignedAt: { not: null }, status: { not: "INVITED" } }
    });
    const purchased = local.seatQuantity ?? 0;
    const needsSync = purchased === 0 || assigned > purchased || local.status === "NONE";

    if (!needsSync) {
      return;
    }
  }

  await syncSeatSubscriptionForCompany(companyId);
}
