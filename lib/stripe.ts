import Stripe from "stripe";

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

export function getSeatPriceId() {
  const priceId = process.env.STRIPE_SEAT_PRICE_ID;

  if (!priceId) {
    throw new Error("STRIPE_SEAT_PRICE_ID is not configured.");
  }

  return priceId;
}

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SEAT_PRICE_ID);
}
