"use server";

import { redirect } from "next/navigation";
import type Stripe from "stripe";
import { appBaseUrl } from "@/lib/app-url";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { autoAssignOwnerOnPurchase } from "@/lib/seats";
import { getSeatPriceId, getStripe, isStripeConfigured } from "@/lib/stripe";

export async function createSeatCheckoutSession(formData: FormData) {
  const actor = await requireAdmin();

  if (!isStripeConfigured()) {
    redirect("/admin/billing?error=Stripe%20is%20not%20configured");
  }

  const quantity = Number(formData.get("quantity"));
  const promoCode = String(formData.get("promoCode") ?? "").trim();

  if (!Number.isInteger(quantity) || quantity < 1) {
    redirect("/admin/billing?error=Quantity%20must%20be%20at%20least%201");
  }

  const stripe = getStripe();
  const priceId = getSeatPriceId();

  let subscription = await prisma.seatSubscription.findUnique({
    where: { companyId: actor.companyId }
  });

  if (!subscription) {
    subscription = await prisma.seatSubscription.create({
      data: { companyId: actor.companyId, status: "NONE", seatQuantity: 0 }
    });
  }

  let customerId = subscription.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: actor.email,
      name: actor.name,
      metadata: { companyId: actor.companyId }
    });
    customerId = customer.id;

    await prisma.seatSubscription.update({
      where: { companyId: actor.companyId },
      data: { stripeCustomerId: customerId }
    });
  }

  const sessionParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity }],
    success_url: `${appBaseUrl()}/admin/billing?success=1`,
    cancel_url: `${appBaseUrl()}/admin/billing?canceled=1`,
    metadata: { companyId: actor.companyId, membershipId: actor.membershipId },
    subscription_data: {
      metadata: { companyId: actor.companyId }
    }
  };

  if (promoCode) {
    const promoCodes = await stripe.promotionCodes.list({
      code: promoCode,
      active: true,
      limit: 1
    });

    if (promoCodes.data[0]) {
      sessionParams.discounts = [{ promotion_code: promoCodes.data[0].id }];
    } else {
      redirect("/admin/billing?error=Invalid%20promo%20code");
    }
  } else if (process.env.STRIPE_DEV_PROMO_CODE) {
    try {
      const promoCodes = await stripe.promotionCodes.list({
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

  const session = await stripe.checkout.sessions.create(sessionParams);

  if (!session.url) {
    redirect("/admin/billing?error=Failed%20to%20create%20checkout%20session");
  }

  redirect(session.url);
}

export async function createBillingPortalSession() {
  const actor = await requireAdmin();

  if (!isStripeConfigured()) {
    redirect("/admin/billing?error=Stripe%20is%20not%20configured");
  }

  const subscription = await prisma.seatSubscription.findUnique({
    where: { companyId: actor.companyId }
  });

  if (!subscription?.stripeCustomerId) {
    redirect("/admin/billing?error=No%20billing%20account%20found");
  }

  const stripe = getStripe();
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${appBaseUrl()}/admin/billing`
  });

  redirect(portalSession.url);
}

export async function syncSeatSubscriptionFromStripe(subscription: Stripe.Subscription) {
  const companyId = subscription.metadata?.companyId;

  if (!companyId) {
    return;
  }

  const firstItem = subscription.items.data[0];
  const price = firstItem?.price;
  const priceId = typeof price === "string" ? price : price?.id ?? null;
  const quantity = firstItem?.quantity ?? 0;
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? null;

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

  await prisma.seatSubscription.upsert({
    where: { companyId },
    create: {
      companyId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      seatQuantity: quantity,
      status: statusMap[subscription.status] ?? "NONE",
      currentPeriodEnd: new Date(subscription.current_period_end * 1000)
    },
    update: {
      stripeCustomerId: customerId ?? undefined,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      seatQuantity: quantity,
      status: statusMap[subscription.status] ?? "NONE",
      currentPeriodEnd: new Date(subscription.current_period_end * 1000)
    }
  });

  const ownerMembership = await prisma.companyMembership.findFirst({
    where: { companyId, role: "OWNER", status: "ACTIVE" },
    orderBy: { createdAt: "asc" }
  });

  if (ownerMembership) {
    await autoAssignOwnerOnPurchase(companyId, ownerMembership.id);
  }
}
