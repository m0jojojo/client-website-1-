# Deploying The Block Bagru (Vercel + Neon)

Plan: put the site on **Vercel** at a free `*.vercel.app` test address, with its **own fresh production database** on Neon and **Razorpay in test mode**. Nothing here touches your real Shopify store. Your real domain comes later.

> **Cost note.** Vercel's free _Hobby_ plan is for personal, non-commercial use. It is fine for this test phase. A shop that takes real orders needs the **Pro** plan (about US$20/month); upgrade before you launch for real.

## What each step needs

| Step                                         | Who          | Where                  |
| -------------------------------------------- | ------------ | ---------------------- |
| 1. Fresh production database                 | You (5 min)  | neon.tech              |
| 2. Load tables and catalog into it           | Me           | your computer          |
| 3. Create the Vercel project                 | You (10 min) | vercel.com             |
| 4. Fill in the settings                      | You          | Vercel dashboard       |
| 5. Google and Razorpay allow the new address | You          | Google Cloud, Razorpay |
| 6. Try the live site                         | You + me     | the live address       |

## Step 1: a fresh production database (you)

Keep your development database as it is. The live site gets its own.

1. Go to https://console.neon.tech and **create a new project**, e.g. `block-bagru-live`, region **AWS Singapore (ap-southeast-1)** (same region as the Vercel functions, `sin1`, set in `vercel.json`).
2. Open the project's **Connect** dialog. Copy two connection strings:
   - **Pooled** (the toggle "Connection pooling" is on; the host contains `-pooler`)
   - **Direct** (toggle off)
3. Save them to a new file `.env.production.local` in the project folder, _without pasting them into chat_. In your terminal, from the project folder:
   ```bash
   read -rs "?Paste the POOLED connection string, then Enter: " P; echo; printf 'DATABASE_URL=%s\n' "$P" > .env.production.local; unset P
   read -rs "?Paste the DIRECT connection string, then Enter: " D; echo; printf 'DATABASE_URL_UNPOOLED=%s\n' "$D" >> .env.production.local; unset D
   ```
   This file is git-ignored (never uploaded). Tell me "saved".

## Step 2: tables and catalog (me)

After you say "saved" I run, against the production database only:

```bash
npm run db:status:prod    # shows what is applied (should be nothing yet)
npm run db:deploy:prod    # creates all tables
npm run db:seed:prod      # loads the 15 collections and 201 products
```

These commands refuse to run if the file points at your development database, print only the database _host name_ (never the password), and the seed refuses if the database already holds customers.

## Step 3: create the Vercel project (you)

1. Sign up / log in at https://vercel.com (use "Continue with GitHub").
2. **Add New -> Project**, pick the repository `m0jojojo/client-website-1-`, click **Import**.
3. Framework is detected as Next.js. Leave the build settings alone. **Do not click Deploy yet**: first add the settings below.
4. Pick a project name you like, e.g. `block-bagru`. Your test address will be `https://block-bagru.vercel.app` (if the name is taken Vercel adds letters; use whatever it shows).

## Step 4: settings (Vercel -> Project -> Settings -> Environment Variables)

Add these for **Production**. Settings are read when the site is _built_, so after changing any of them you must **redeploy**.

| Name                                       | Value                                                                | Notes                                                                                                                 |
| ------------------------------------------ | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                             | the **pooled** production string                                     | from Step 1                                                                                                           |
| `BETTER_AUTH_SECRET`                       | a new random secret                                                  | create with `openssl rand -base64 48` in your terminal; never reuse the development one                               |
| `BETTER_AUTH_URL`                          | `https://block-bagru.vercel.app`                                     | your exact live address, no trailing slash                                                                            |
| `NEXT_PUBLIC_SITE_URL`                     | same address                                                         | used for canonical links and the sitemap                                                                              |
| `NEXT_PUBLIC_ALLOW_INDEXING`               | `false`                                                              | **keeps the test site out of Google** (robots.txt blocks everything and every page says noindex). Remove it at launch |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | the same pair as development                                         | see Step 5                                                                                                            |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`   | your **test** keys (`rzp_test_...`)                                  | test mode only for now                                                                                                |
| `RAZORPAY_WEBHOOK_SECRET`                  | a new secret you choose                                              | the same value goes into Razorpay's webhook screen (Step 5)                                                           |
| `NEXT_PUBLIC_WHATSAPP_NUMBER`              | your real number, digits only with country code, e.g. `919785987678` | the button uses a placeholder until set                                                                               |

**Do not set** `PAYMENTS_MOCK`, `AUTH_RATE_LIMIT_DISABLED` or `DATABASE_URL_UNPOOLED` on Vercel. (The first two are development and test switches; the mock payment window cannot turn on for a real address anyway.)

Then click **Deploy**. The first build takes a couple of minutes. If `BETTER_AUTH_URL` and `NEXT_PUBLIC_SITE_URL` were set before you knew the final address, correct them and **Redeploy**.

## Step 5: let Google and Razorpay know the address (you)

- **Google sign-in** (https://console.cloud.google.com -> Google Auth Platform -> Clients -> your client): add
  - Authorized JavaScript origin: `https://block-bagru.vercel.app`
  - Authorized redirect URI: `https://block-bagru.vercel.app/api/auth/callback/google`
    Keep your own Google account in **Test users** while the app is in Testing mode.
- **Razorpay** (Test Mode -> Account & Settings -> Webhooks -> Add new webhook): URL `https://block-bagru.vercel.app/api/webhooks/razorpay`, the same secret as `RAZORPAY_WEBHOOK_SECRET`, events `payment.captured`, `order.paid`, `payment.failed`.

## Step 6: smoke test on the live address

1. Home page, a collection, a product, search all load. The browser tab titles match the local site.
2. `https://.../robots.txt` shows `Disallow: /`; view a page's source and find `noindex`.
3. Sign in with Google; add an address; wishlist a product; add to cart.
4. Check out with **cash on delivery**, then with **Razorpay test payment** (UPI `success@razorpay` or card `5267 3181 8797 5449`). Confirm the order page says "Payment received".
5. Razorpay dashboard -> Webhooks shows deliveries with status 200.
6. Open your orders in **Account -> Orders**.

## When you are ready to go live for real (later)

1. Upgrade Vercel to Pro. Complete Razorpay KYC and generate **Live** keys; swap them in (and the webhook) in Vercel.
2. Connect `theblockbagru.com` in Vercel (Project -> Domains). Update `BETTER_AUTH_URL` and `NEXT_PUBLIC_SITE_URL` to it, add it to the Google client (origin + redirect), and **delete** `NEXT_PUBLIC_ALLOW_INDEXING`. Redeploy.
3. Add redirects from the old Shopify addresses, submit the sitemap in Google Search Console, and publish the Google sign-in app (OAuth consent screen -> Publish).
4. Keep your test orders out of reports: the live database starts clean, so nothing to remove.

## Day-to-day

- Every push to `main` on GitHub deploys automatically. Pull requests get their own private preview address (hidden from Google).
- New database changes: run `npm run db:deploy:prod` **before** pushing code that needs them.
- Never run `npm run db:seed` against the live database; the guard will refuse once customers exist.
- Logs and errors: Vercel -> Project -> Logs.
