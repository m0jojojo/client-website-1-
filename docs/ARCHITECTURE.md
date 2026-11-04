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
