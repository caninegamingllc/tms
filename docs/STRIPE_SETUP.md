# Stripe Seat Billing Setup

This TMS bills per organization for seats at **$25/seat/month** via Stripe.

## Dashboard setup

1. Create a **Product** named `TMS Seat`.
2. Add a recurring **Price** at `$25.00` / month with per-unit billing (quantity = number of seats).
3. Copy the Price ID into `STRIPE_SEAT_PRICE_ID`.
4. Create a **Coupon** with 100% off (duration: forever or repeating).
5. Create a **Promotion code** from that coupon (recommended dev code: `DEV100`).
6. Add API keys to `.env`:
   - `STRIPE_SECRET_KEY`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - `STRIPE_SEAT_PRICE_ID`
   - `STRIPE_DEV_PROMO_CODE=DEV100` (optional default for checkout)
7. Configure a webhook endpoint:
   - URL: `{APP_BASE_URL}/api/stripe/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
   - Copy the signing secret to `STRIPE_WEBHOOK_SECRET`

## Local webhook testing

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Use the signing secret printed by the Stripe CLI in `STRIPE_WEBHOOK_SECRET` while developing locally.

## Behavior

- Seats are purchased per organization and stored on `SeatSubscription.seatQuantity`.
- Admins assign seats to members in **Admin**.
- Operational TMS pages require an assigned seat.
- Admin and Billing remain available to owners/admins without a seat.
- Invites to existing accounts are allowed; accepting auto-assigns a seat when one is available.
