# Phase 3: Home page

## Built

- **Hero slider** (`HeroSlider`): 3 placeholder banners (New Arrivals, Maheshwari Silk Sarees, Cotton Suit Sets), previous/next buttons, dots, autoplay every 6s. Autoplay pauses on hover/focus and is off when the visitor prefers reduced motion.
- **Shop By Category**: all 13 collections as tiles linking to `/collections/<handle>` (placeholder images).
- **Product carousels** (`ProductSection`, `Carousel`, `ProductCard`): Trending Now, Saree Collection (Maheshwari), Mulmul Sarees, Suits Collection (Kota Dupatta), Shop All, each with up to 10 products from the database, a "View all" link, price, struck-through regular price, `% OFF` badge and `Sold out` badge. Data loads at request time inside Suspense, with skeleton placeholders.
- **Trust strip** (free shipping, secure payments, COD, support) and **Voices of Royalty** testimonials (placeholder quotes).
- All copy and layout config lives in `src/lib/home.ts`.

## Run

`npm run dev`, open http://localhost:3000 (needs `.env.local` with `DATABASE_URL` and a seeded database for the product carousels).

## Manual test checklist

1. Hero shows "New Arrivals"; arrows and dots change slides; it advances by itself after about 6 seconds and stops while the mouse is over it.
2. Shop By Category shows 13 tiles; layout is 5 columns on desktop, 3 on tablet, 2 on phone.
3. Five product sections show real products with prices. Example: Mulmul Sarees shows 5 products at ₹899 with 40% OFF; some Trending items show "Sold out".
4. Carousels scroll sideways with the mouse wheel/trackpad/touch; on desktop the round arrow buttons also scroll them.
5. Trust strip and testimonials appear above the footer.
6. Resize to phone width: no sideways page scrolling, everything readable.
7. Press Tab through the page: focus is visible on slider buttons, tiles, cards.
8. Clicking any tile or product goes to a page that does not exist yet (404). Expected until Phase 4 and Phase 5.

## Automated tests

- `npm test`: 47 unit/component tests.
- `npm run test:e2e`: 22 passing e2e tests, including accessibility (axe) with real products loaded. Tests marked "with catalog data" are skipped automatically when `DATABASE_URL` is not set (for example in CI).

## Known gaps / decisions

- Images are placeholders everywhere (hero banners use solid colors). Real photos come when you supply them.
- Testimonials are sample text: replace `testimonials` in `src/lib/home.ts` with real reviews before launch.
- "Shop All" links to `/collections/all` (implemented in Phase 4).
- CI has no database yet, so the "with catalog data" e2e tests run only locally. Add a `DATABASE_URL` secret pointing at a separate Neon branch to run them in CI.
- Home page is partially prerendered: the page shell is static, product sections stream in. If the database is down, the product sections are simply omitted.
