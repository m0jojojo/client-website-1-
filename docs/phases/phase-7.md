# Phase 7: Accounts and sign-in

## Built

- **Google sign-in** with [Better Auth](https://www.better-auth.com) running inside the app and storing users and sessions in your Neon database (tables `User`, `Session`, `Account`, `Verification`). Google is the only sign-in method, so there are no passwords and no emails to send. We receive only the customer's name and email.
- **Sessions**: 30 days, signed HttpOnly cookie (`better-auth.session_token`, Secure in production, SameSite=Lax).
- **Pages**: `/account/login` (Continue with Google), `/account` (overview), `/account/addresses` (add, edit, delete, set default), `/account/orders` (empty until Phase 8), `/wishlist` (now saved to the account). Signed-out visitors who open an account page are sent to sign in and then back to that page.
- **Header**: the person icon becomes a circle with the customer's initial when signed in.
- **Addresses** (Indian format): name, mobile (10 digits, `+91`/spaces accepted), house/street, area, landmark, city, state (all 36 states and union territories), 6-digit PIN code. Up to 10 per customer; exactly one default; deleting the default promotes another. Used at checkout in Phase 8.
- **Cart and wishlist follow the customer**:
  - A signed-in customer's cart lives in their account (same cart on every device).
  - At sign-in the browser's guest cart is merged into the account cart (quantities add up, max 10 per item) and the guest cart cookie is removed.
  - The browser wishlist is merged into the account wishlist; from then on every heart click is saved to the account.
  - On sign-out the wishlist saved in this browser is wiped, so the next person on a shared computer starts clean (the account keeps its copy).
- **Security**: every account API checks the session, rejects other websites' requests (Origin check), validates input strictly (unknown fields are refused), and only ever touches the signed-in customer's own rows. Login redirects can only go to pages on this site. Better Auth's rate limits stay on for sign-in (3 attempts per 10 s per IP); only session checks are exempt.
- Prisma migrations now use Neon's direct (non-pooled) connection through `DATABASE_URL_UNPOOLED` to avoid migration-lock problems.

## One-time setup you must do: Google credentials

Without these the login page shows "Google sign-in isn't set up yet" and everything else works as a guest.

1. Go to https://console.cloud.google.com, create (or pick) a project.
2. **APIs & Services -> OAuth consent screen**: choose **External**, set app name "The Block Bagru", your support email, and add the scopes `openid`, `email`, `profile`. While the app is in "Testing" mode add your own Google address under **Test users**. (Publish the app before launch so any customer can sign in.)
3. **APIs & Services -> Credentials -> Create credentials -> OAuth client ID -> Web application**.
   - Authorized JavaScript origins: `http://localhost:3000` (and later your real domain, e.g. `https://yourdomain.com`)
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google` (and later `https://yourdomain.com/api/auth/callback/google`)
4. Copy the **Client ID** and **Client secret** into `.env.local` (do not paste them into chat):
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   ```
5. Restart the dev server (`npm run dev`).

`.env.local` already contains a generated `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL=http://localhost:3000`. For Vercel, add `BETTER_AUTH_SECRET` (a new random value), `BETTER_AUTH_URL` (your real URL), the two Google values and `DATABASE_URL` as environment variables.

## Manual test checklist (needs the Google credentials above)

1. Open `/account` while signed out: you land on the sign-in page, and after signing in you return to `/account`.
2. Click **Continue with Google**, pick your account: you return signed in, and the header shows a circle with your initial.
3. Before signing in (in a private window), add a product to the cart and heart two products. Then sign in: the cart badge and wishlist count stay, and the guest cart merges into your account.
4. Addresses: add one with a bad phone (error shows under the field), then a valid one (becomes Default). Add a second, make it default, edit the first, delete one (it asks first). Reload: everything persists.
5. Open the site in a second browser, sign in with the same Google account: same cart, wishlist and addresses.
6. **Sign out** from `/account`: header shows the person icon again, `/wishlist` is empty on this browser, `/account` asks you to sign in.
7. Visit `/account/login?next=https://evil.example` while signed in: you end up on `/account`, not on that site.
8. Phone width: login, overview and addresses all fit without sideways scrolling.

(All of this except the real Google screen is also covered by automated tests, which sign in with generated test customers.)

## Automated tests

- `npm test`: 200 unit/component tests (redirect safety, address validation, login card, header link, sync behaviour, address manager, rate-limit config).
- `npm run test:integration`: 49 database tests (signed-cookie verification and tampering, cascade delete, address rules and isolation, account wishlist, guest-cart merging).
- `npm run test:e2e`: 184 end-to-end tests on desktop and mobile Chrome (sign-in redirects, account pages, address CRUD, cart/wishlist merging, cross-device sync, sign-out, API security checks, accessibility). Test customers are created and removed directly in the database, so no Google account is needed.
- Test customers use `@e2e.test` email addresses and are deleted after each test.

## Known gaps / decisions

- Google only: no email/password, no phone OTP. Account deletion and exporting data are not built yet (planned with Phase 11 hardening; needed for privacy compliance).
- Orders appear in Phase 8. Guest checkout stays allowed; orders will be matched to accounts by email later.
- The login merge makes several database queries and takes a few seconds from a distant dev machine. In production run the Vercel functions in the same region as Neon (Singapore, `sin1`) to cut this to a fraction of a second.
- Better Auth's rate limiter keeps its counters in each server instance's memory. On Vercel that limits less strictly than it looks; move it to the database or a shared store in Phase 11.
- `AUTH_RATE_LIMIT_DISABLED=true` exists only for the automated browser tests. Never set it in production.
- Google profile photos are not shown (an initial is used) to avoid loading third-party images.
