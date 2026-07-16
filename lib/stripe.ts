import Stripe from "stripe";
import { normalizePlanId, type PlanId } from "@/lib/plans";

let stripeClient: Stripe | null = null;

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey);
  }

  return stripeClient;
}

/** @deprecated Prefer getPlanPriceId — kept for legacy per-seat subscriptions. */
export function getSeatPriceId() {
  const priceId = process.env.STRIPE_SEAT_PRICE_ID;
  if (!priceId) {
    throw new Error("STRIPE_SEAT_PRICE_ID is not configured.");
  }
  return priceId;
}

export function getLitePriceId() {
  const priceId = process.env.STRIPE_LITE_PRICE_ID;
  if (!priceId) {
    throw new Error("STRIPE_LITE_PRICE_ID is not configured.");
  }
  return priceId;
}

export function getPremiumPriceId() {
  const priceId = process.env.STRIPE_PREMIUM_PRICE_ID;
  if (!priceId) {
    throw new Error("STRIPE_PREMIUM_PRICE_ID is not configured.");
  }
  return priceId;
}

export function getPlanPriceId(plan: Exclude<PlanId, "FREE">) {
  return plan === "LITE" ? getLitePriceId() : getPremiumPriceId();
}

export function isStripeConfigured() {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      (process.env.STRIPE_LITE_PRICE_ID ||
        process.env.STRIPE_PREMIUM_PRICE_ID ||
        process.env.STRIPE_SEAT_PRICE_ID)
  );
}

export function resolvePlanFromStripePrice(
  priceId: string | null | undefined,
  quantity = 1
): { plan: PlanId; seatQuantity: number } {
  if (priceId && priceId === process.env.STRIPE_LITE_PRICE_ID) {
    return { plan: "LITE", seatQuantity: 5 };
  }

  if (priceId && priceId === process.env.STRIPE_PREMIUM_PRICE_ID) {
    return { plan: "PREMIUM", seatQuantity: 999 };
  }

  // Legacy $25/seat price: treat as Premium and honor purchased quantity.
  if (priceId && priceId === process.env.STRIPE_SEAT_PRICE_ID) {
    return { plan: "PREMIUM", seatQuantity: Math.max(1, quantity) };
  }

  return { plan: normalizePlanId(null), seatQuantity: Math.max(1, quantity) };
}
