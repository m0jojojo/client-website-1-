# Changelog

All notable changes are documented here. Format based on Keep a Changelog.

## [Unreleased]

### Added

- Hosting preparation: Vercel settings (Singapore region, Node 24), seed safety guard that refuses to wipe a database holding customer data, separate production database commands (`db:deploy:prod`, `db:status:prod`, `db:seed:prod`) that refuse to touch the development database, a build-time switch that keeps a test site out of Google (robots and noindex), and a step-by-step deployment guide.

- SEO S2 (titles and descriptions): unique, length-checked titles and descriptions for the home page, collections (with paging) and all products; ALL CAPS names made readable; identical product names tagged "(Ref …)"; empty collections kept out of the sitemap and marked noindex; unit, database and browser tests.

- SEO S1 (foundations): site address setting, sitemap.xml, robots.txt (previews blocked), canonical links with sorted/filtered views kept out of the index, en-IN language, real 404 status for missing products and collections via a request proxy, branded not-found page; unit and browser tests.

- Phase 8: checkout page, orders (numbers from BB1001), cash on delivery and Razorpay online payment with a 10% prepaid discount, server-side signature verification, signed webhook, order status page with Pay now, account order list, guest order claiming at sign-in, local test-payment mode, and unit, database and browser tests.

- Phase 7: Google sign-in with Better Auth on Neon, account area (overview, addresses, orders placeholder), saved Indian delivery addresses, account-owned cart and wishlist with guest-to-account merge at sign-in, security checks (origin, strict validation, safe redirects, rate limits), unit, integration, e2e and accessibility tests.

- Phase 6: server-side shopping cart (Neon) with drawer and /cart page, live Add to cart, header cart badge; browser-saved wishlist with heart buttons, header count and /wishlist page; `handles` filter in the products API; cart and wishlist unit, integration, e2e and accessibility tests.

- Phase 5: product detail page with gallery and enlarge dialog, price and discount block, variant and quantity controls, sold-out handling, trust badges, description, related products, breadcrumbs, SEO metadata and structured data; unit, integration, e2e and accessibility tests.

- Phase 4: collection pages with availability and price filters, 7 sort options and numbered pagination; search results page; header search with live suggestions; `/collections/all`; filter/sort/search support in the JSON API; unit, integration, e2e and accessibility tests.

- Phase 3: home page with hero slider, 13 category tiles, five product carousels from the catalog, trust strip and testimonials; ProductCard and Carousel components; unit, e2e and accessibility tests.

- Phase 2: Prisma/Neon Postgres schema (collections, products, variants, images), catalog data layer, JSON catalog API, seed from live store (201 products, 15 collections), unit and integration tests.

- Phase 1: design tokens (DM Sans, navy accent), Button/Card primitives, promo strip, responsive header with category dropdowns, footer, floating WhatsApp button, unit/e2e/a11y tests.

- Phase 0: Next.js + TypeScript + Tailwind scaffold, ESLint, Prettier, Husky, lint-staged,
  commitlint, Vitest, Playwright, GitHub Actions CI, documentation skeleton.
