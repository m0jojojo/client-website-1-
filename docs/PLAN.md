# The Block Bagru Clone: Development Plan (DRAFT v0.1)

Status: draft. Open questions (section 2) must be answered before Phase 0 starts.

## 1. What the target is

theblockbagru.com is a Shopify-style e-commerce store selling handcrafted block-printed (Bagru/Ajrakh) sarees and suits from Rajasthan.

- Nav: Home, New Arrivals, Sarees (6 sub-categories), Suits (4 sub-categories), About, Contact. Utilities: search, login, cart, wishlist.
- Home: promo strip, hero slider, Shop-by-Category tiles (13), product carousels (Trending, Sarees, Mulmul, Suits, Shop All), trust strip (free shipping, secure checkout, COD, support), testimonials, floating WhatsApp button.
- Footer: quick links, policies (shipping, returns, privacy, terms), contact details, address, GSTIN.
- Commerce: product listing, sale price and discount %, sold-out labels, image galleries, cart, wishlist, accounts, checkout.

## 2a. Answers received

- Purpose: own/client store (real branding/content allowed, ownership to be confirmed with assets)
- Stack: custom Next.js + TypeScript
- Scope: full commerce (auth, cart, orders, payments, admin)
- Payments: Razorpay

- Database: PostgreSQL + Prisma
- Hosting/DB: you said "Vercel" for both after first saying Cloudflare. Assumed: app on Vercel, Postgres via Vercel Marketplace (Neon). Cloudflare, if used at all, only for DNS/CDN. NEEDS CONFIRMATION.
- Assets: placeholders for now (swap in real, owned assets later)
- Email: Resend
- Repo: project folder is `client-website-1`; remote repo will be created by you and its URL given before the first push

## 2. Open questions (remaining: Vercel vs Cloudflare confirmation, remote repo URL)

1. Ownership/purpose: is this your own/client's store, or a learning/portfolio clone? (Decides whether we can reuse real branding, images and copy.)
2. Stack: keep it on Shopify (theme dev) or build custom full-stack?
3. If custom: preferred stack (e.g. Next.js + TypeScript + PostgreSQL/Prisma)?
4. Scope: full working commerce (auth, cart, orders, payments, admin) or storefront only with seed data?
5. Payments: Razorpay (India), Stripe, COD only, or mocked?
6. Content and images: use placeholders, or real assets you provide/own?
7. Hosting target: Vercel, VPS, other?
8. Git: remote repo available? Commit convention OK as Conventional Commits?

## 3. Working rules

- One phase at a time. After each phase I STOP, give a test checklist, and wait for your explicit "approved" before continuing.
- After each approved phase I ask you to commit. I only commit on your yes.
- Commits: Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`), one logical change each, branch per phase (`phase-N-name`), merged after approval.
- Docs: README, `docs/ARCHITECTURE.md`, `docs/phases/phase-N.md` (what was built, how to test, known gaps), `CHANGELOG.md`, `.env.example`.
- Tests: every feature ships with tests (unit + component + e2e where relevant). A phase is not "done" with failing tests.
- Anything I am under 80% sure about becomes a question to you, not a guess.

## 4. Phases (assuming custom Next.js + TS; will change per answers)

**Phase 0: Discovery & setup.** Page/asset inventory, design tokens (colors, fonts, spacing), repo, tooling (ESLint, Prettier, Vitest, Playwright, Husky, commitlint), CI, docs skeleton. Tests: smoke test, lint/CI green.

**Phase 1: Design system & layout shell.** Tokens, typography, buttons, cards, header with mega/dropdown menu, promo strip, footer, responsive grid, floating WhatsApp button. Tests: component tests, responsive and a11y checks.

**Phase 2: Data model & catalog backend.** DB schema (products, variants, collections, images, inventory), seed data, product/collection API. Tests: API and DB integration tests.

**Phase 3: Home page.** Hero slider, category tiles, product carousels, trust strip, testimonials. Tests: component + e2e.

**Phase 4: Collection & search.** Listing pages, sorting, filters, pagination, search, sale/sold-out badges. Tests: unit + e2e.

**Phase 5: Product detail page.** Gallery, variants, price/discount, stock state, related items. Tests: component + e2e.

**Phase 6: Cart & wishlist.** Add/update/remove, persistence, drawer, wishlist toggle. Tests: unit + e2e.

**Phase 7: Auth & account.** Sign-up/login, sessions, profile, addresses, order history, wishlist sync. Tests: auth flow + security tests.

**Phase 8: Checkout & payments.** Address, shipping, COD/online payment, order creation, confirmation emails. Tests: integration with mocked provider, e2e happy/failure paths.

**Phase 9: Static & content pages.** About, Contact (form), policies, 404. Tests: e2e + form validation.

**Phase 10: Admin (optional).** Product/order management. Tests: authz + CRUD.

**Phase 11: Hardening & launch.** SEO/meta, performance, accessibility audit, security review, error monitoring, deployment, final docs. Tests: Lighthouse budget, full e2e regression.

## 5. Per-phase checkpoint template

1. Summary of what was built
2. How to run it
3. Manual test checklist
4. Automated test results
5. Known gaps
6. Prompt: "Approve? Then commit with: `<proposed message>`"
