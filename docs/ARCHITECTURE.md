# Architecture

Living document, updated each phase.

- Framework: Next.js App Router, TypeScript, Tailwind CSS
- Data: PostgreSQL (Neon, via Vercel Marketplace) with Prisma 7; money stored as integer paise
- Payments (Phase 8): Razorpay. Email: Resend
- Hosting: Vercel
- Tests: Vitest + Testing Library (unit/component), Playwright (e2e)

Layout: `src/app` routes, `tests/unit`, `tests/e2e`, `docs/`.

Data layer: `src/lib/catalog` (queries, pricing, params), DB client `src/lib/db.ts`, API under `src/app/api`. Seed snapshot in `prisma/seed`.

Cart: `src/lib/cart` (service, token, http helpers) + `/api/cart`; state in the browser via `CartProvider`. Carts are rows in Neon keyed by a hashed cookie token; prices are always read from the catalog. Wishlist: `src/lib/wishlist-store.ts` (localStorage external store).

Accounts: Better Auth (`src/lib/auth.ts`) with the Prisma adapter and Google as the only provider; session helpers in `src/lib/auth-session.ts`; account services in `src/lib/account`. Carts are owned by a user or by an anonymous cookie (`CartOwner`); `/api/account/sync` merges the guest cart and wishlist at sign-in.

Checkout and payments: `src/lib/orders` (pricing, validation, order service) and `src/lib/payments` (Razorpay signatures, order creation, mock-mode rules). The browser sends only identity, address and payment method; the server prices everything from its own cart and catalog. Payments are confirmed by a verified signature (`/api/checkout/verify`) or a signed webhook (`/api/webhooks/razorpay`), both idempotent. Guests open their order with a secret token in the link.
