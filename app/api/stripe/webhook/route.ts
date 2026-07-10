import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { syncSeatSubscriptionFromStripe } from "@/lib/billing-actions";
import { autoAssignOwnerOnPurchase } from "@/lib/seats";
import { getStripe } from "@/lib/stripe";

function getInvoiceSubscriptionId(invoice: Stripe.Invoice) {
  const subscription = (invoice as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null;
  }).subscription;

  if (!subscription) {
    return null;
  }

  return typeof subscription === "string" ? subscription : subscription.id;
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = (await headers()).get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription && typeof session.subscription === "string") {
          const subscription = await stripe.subscriptions.retrieve(session.subscription, {
            expand: ["items.data.price"]
          });
          await syncSeatSubscriptionFromStripe(subscription);

          const companyId = session.metadata?.companyId ?? subscription.metadata?.companyId;
          const membershipId = session.metadata?.membershipId;

          if (companyId && membershipId) {
            await autoAssignOwnerOnPurchase(companyId, membershipId);
          }
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await syncSeatSubscriptionFromStripe(
          await stripe.subscriptions.retrieve(subscription.id, {
            expand: ["items.data.price"]
          })
        );
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = getInvoiceSubscriptionId(invoice);

        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
            expand: ["items.data.price"]
          });
          await syncSeatSubscriptionFromStripe(subscription);
        }
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error("[stripe webhook]", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
