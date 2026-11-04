# Phase 8: Checkout, orders and payments

## Decisions used (you did not answer the questions, so these are the defaults I proposed)

- **Payment options:** online through Razorpay (UPI, cards, netbanking, wallets) with **10% off**, or **cash on delivery at full price**.
- **COD:** free, no extra fee, no order-value limit (as on your live site).
- **Shipping:** free. **Prices include tax** ("Taxes included").
- **Stock:** unchanged: an item is in stock or sold out (no counts). Two buyers can still both order the last piece; see "Known gaps".
- **Guest checkout:** allowed. Signed-in customers get their email and saved addresses pre-filled.
- **Razorpay keys:** none yet, so everything was built and tested with a **local stand-in** for the Razorpay window. The real Razorpay path is built to Razorpay's documented API but has **not** been run against Razorpay itself. See "Switching on real Razorpay".

## What was built

- **Checkout page `/checkout`:** contact (email, mobile), delivery address (a saved address, or type a new one and optionally save it), payment choice, and a live order summary (items, prepaid discount, free shipping, total). Prices are only ever shown here; the **server recalculates everything** from the database and refuses any price, total or discount sent by the browser.
- **Orders** (new tables `Order`, `OrderItem`, `PaymentEvent`): each order keeps a permanent copy of the items, prices and address at purchase time. Order numbers are `BB1001`, `BB1002`, ... Orders are `PENDING_PAYMENT`, `CONFIRMED` or `CANCELLED`; payment is `PENDING`, `PAID`, `FAILED` or `REFUNDED`.
- **Cash on delivery:** confirmed immediately; purchased items are removed from the cart.
- **Online payment:** the order is saved as "waiting for payment" and a Razorpay payment order is created for the exact total. The customer pays in Razorpay's window; our server then **verifies Razorpay's cryptographic signature** before marking the order paid. The cart is only emptied after payment is confirmed.
- **Webhook `/api/webhooks/razorpay`:** Razorpay also tells us about payments directly, so an order is confirmed even if the customer closes the tab after paying. Requests must carry a valid signature over the raw body; repeated deliveries and wrong amounts are handled safely.
- **Order page `/orders/BB1001`:** status, items, totals, delivery address. Guests open it with a private link (`?token=...`) shown right after checkout; signed-in customers see their own orders without it. For unpaid online orders it shows **Pay now**, including after a failed attempt.
- **Account:** `/account/orders` is now a real list. At sign-in, orders placed as a guest with the same (Google-verified) email join the account.
- **Safety nets:** double-clicking Place order makes one order (idempotency key); sold-out items block checkout and are named; strangers (and other customers) get "page not found" for orders that are not theirs; order pages are `noindex` and send no referrer (their link contains a secret).

## Try it now (no Razorpay account needed)

`.env.local` has `PAYMENTS_MOCK=true`, which shows a clearly marked **test payment window** instead of Razorpay's. It only works when the site address is localhost, and it can never switch on for a real website.

## Manual test checklist

1. Add a product (quantity 2) and click **Checkout** in the cart drawer. The summary shows subtotal, "Prepaid discount (10%)", Free shipping and a total.
2. Choose **Cash on delivery**: the discount disappears and the total is the full price. Fill the form and place the order: the order page says "Order placed. Thank you!", the cart is empty.
3. Add a product again, choose **Pay online**, fill the form, click Pay: a **TEST MODE** window opens. Choose "Pay ... (test)": the order page says "Payment received. Thank you!" and the cart is empty.
4. Repeat but choose **Simulate a failed payment**: the order page says "Waiting for your payment" with the reason; **Pay now** works again and then confirms. Also try **Cancel**: the order stays waiting.
5. Submit with an empty form, a bad mobile number (e.g. 123) and a bad PIN code (e.g. 12): the problem is shown next to each field.
6. Sign in with Google, add a product, open checkout: your email and your saved addresses are filled in. Place an order, then open **Account -> Orders**.
7. Copy a guest order's link (with `?token=`) into a private window: it opens. Remove `?token=...`: "page not found".
8. Double-click **Place order**: only one order is created.
9. Phone width: the form and summary stack, nothing scrolls sideways.

## Switching on real Razorpay (when you have keys)

1. Create a Razorpay account (https://razorpay.com). In **Test mode** go to **Account & Settings -> API keys -> Generate key**; copy the Key ID (`rzp_test_...`) and Key Secret.
2. Put them in `.env.local` (not in chat):
   ```
   RAZORPAY_KEY_ID=rzp_test_...
   RAZORPAY_KEY_SECRET=...
   ```
   Real keys automatically replace the test window. Restart `npm run dev`.
3. Webhooks: **Account & Settings -> Webhooks -> Add new webhook**. URL `https://YOUR-DOMAIN/api/webhooks/razorpay` (for local testing use a tunnel such as ngrok), a secret of your choice, and the events `payment.captured`, `order.paid` and `payment.failed`. Put the secret in `.env.local` as `RAZORPAY_WEBHOOK_SECRET=...`.
4. Pay with Razorpay's test cards/UPI (https://razorpay.com/docs/payments/payments/test-card-details/). I will then confirm the real flow works with you.
5. **Going live:** complete Razorpay KYC, generate **Live** keys, set the live keys and webhook secret as Vercel environment variables, and make sure `PAYMENTS_MOCK` is not set there.

## Automated tests

- `npm test`: 281 unit/component tests (money maths, rounding, input validation, payment configuration and the localhost-only rule, signatures including tampering, the Razorpay order call, the checkout form, the test window, the real-Razorpay window with a fake, order page text).
- `npm run test:integration`: 71 database tests (orders, totals, idempotency incl. simultaneous requests, sold-out, saved addresses and their ownership, paying exactly once, wrong amounts, cancelled orders, partial cart clearing, who can see an order, guest-order claiming).
- `npm run test:e2e`: 288 browser tests on desktop and mobile Chrome, including full COD and online flows, failed payments and retries, privacy checks, forged requests (prices, signatures, other websites) and webhook attacks (bad signature, duplicates, wrong amount, bad or oversize bodies), plus accessibility.

## Known gaps / things to decide later

- **No emails yet.** The confirmation page is the only confirmation; the server log records each confirmed order. Emails arrive with Resend (planned).
- **No cancel, refund, shipping status or admin screen yet** (Phase 10). `REFUNDED` and `CANCELLED` exist in the data but nothing sets them.
- **Unpaid online orders never expire** and never release anything (nothing is reserved). They stay "waiting for payment" until paid.
- **Stock is not counted.** Two people can order the same last piece. Add stock counts if that matters.
- If a **guest** pays online and closes the tab before our server confirms, the order is still confirmed by the webhook (once configured), but that guest's cart is not emptied (we cannot know their cart then).
- **No delivery-area (PIN code) check, GST invoice, or order tracking** yet.
- The real Razorpay payment window and API call are untested against Razorpay itself until you add test keys.
- One Next.js build warning about a random value during prerendering of the product page was seen once, on a cold first request, and not again. It does not affect behaviour.
- Rate limiting on checkout is planned for Phase 11.
