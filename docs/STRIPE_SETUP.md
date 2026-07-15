# Stripe Plan Billing Setup

This TMS bills per organization for **subscription plans**:

| Plan | Price | Seats |
|------|-------|-------|
| Free | $0 | 1 |
| Lite | $20/month | up to 5 |
| Premium | $60/month | unlimited (stored as 999) |

Feature access is controlled by `SeatSubscription.plan` (`FREE` | `LITE` | `PREMIUM`). See `lib/plans.ts`.

## Dashboard setup

1. Create products **TMS Lite** and **TMS Premium**.
2. Add recurring monthly Prices: **$20.00** (Lite) and **$60.00** (Premium).
3. Copy Price IDs into:
   - `STRIPE_LITE_PRICE_ID`
   - `STRIPE_PREMIUM_PRICE_ID`
4. (Optional) Keep a legacy per-seat Price as `STRIPE_SEAT_PRICE_ID` — existing subscriptions on that price map to Premium and keep their seat quantity.
5. Create a **Coupon** with 100% off and a promotion code (e.g. `DEV100` / `tms100`).
6. Add API keys to `.env`:
   - `STRIPE_SECRET_KEY`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - `STRIPE_LITE_PRICE_ID`
   - `STRIPE_PREMIUM_PRICE_ID`
   - `STRIPE_DEV_PROMO_CODE` (optional)
   - `STRIPE_WEBHOOK_SECRET`
7. Configure a webhook endpoint:
   - URL: `{APP_BASE_URL}/api/stripe/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`

## Local webhook testing

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Use the signing secret printed by the Stripe CLI in `STRIPE_WEBHOOK_SECRET` while developing locally.

## Behavior

- New companies start on **Free** with one seat assigned to the owner.
- Admins upgrade to Lite or Premium from **Admin → Billing**.
- Seat counts and feature gates follow the plan (nav, pages, and server actions).
- Canceling a paid Stripe subscription returns the org to Free (1 seat); excess seats are unassigned.
- Admin and Billing remain available to owners/admins without a seat.
