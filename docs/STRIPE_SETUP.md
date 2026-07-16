# Stripe Plan Billing Setup

This TMS bills per organization for **subscription plans** with **per-seat quantity**:

| Plan | Price | Seat purchase |
|------|-------|---------------|
| Free | $0 | 1 included seat (cannot buy more) |
| Lite | $20 / seat / month | Purchase 1–5 seats |
| Premium | $60 / seat / month | Purchase any number of seats |

Feature access is controlled by `SeatSubscription.plan` (`FREE` | `LITE` | `PREMIUM`). Purchased seats are stored on `SeatSubscription.seatQuantity` (from Stripe subscription item quantity). See `lib/plans.ts`.

## Dashboard setup

1. Create products **TMS Lite** and **TMS Premium**.
2. Add recurring monthly **per-unit** Prices: **$20.00** (Lite) and **$60.00** (Premium). Quantity on the subscription = number of seats.
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
- Admins choose Lite or Premium from **Admin → Billing** and enter the **total** seats to purchase.
- Lite rejects quantities above 5; Premium has no maximum.
- The whole organization is billed on a single plan rate (never mix Lite and Premium seats).
- Seat assignment and feature gates follow purchased quantity + plan features.
- Canceling a paid Stripe subscription returns the org to Free (1 seat); excess seats are unassigned.
- Admin and Billing remain available to owners/admins without a seat.
