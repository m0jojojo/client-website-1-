# SEO step S1: Foundations

## What was added

- **Site address setting:** `NEXT_PUBLIC_SITE_URL` (e.g. `https://theblockbagru.com`, no trailing slash). It feeds canonical links, the sitemap and `robots.txt`. If it is missing the site falls back to Vercel's production address, then `BETTER_AUTH_URL`, then localhost. **Set it to the real domain at launch** (locally and in Vercel).
- **`/sitemap.xml`:** the home page, `/collections/all`, every collection and every published product (with the date each product last changed). Private pages are not listed. It is read live, so new products appear without a rebuild. To add About, Contact or policy pages later, add their paths to `STATIC_PATHS` in `src/app/sitemap.ts`.
- **`/robots.txt`:** allows the shop; blocks `/api/`, `/cart`, `/checkout`, `/account`, `/orders`, `/wishlist`, `/search`; names the sitemap. On Vercel **preview** deployments (or when `NEXT_PUBLIC_ALLOW_INDEXING=false`) it blocks everything so test copies never appear in Google. This was planned for launch but is cheap protection, so it is on now.
- **Canonical links** (the "official address" of a page) on the home page, products and collections. Rules for collections:
  - plain collection page: points to itself
  - page 2, 3, ...: each points to itself and stays indexable
  - sorted or filtered views (`?sort=`, `?availability=`, `?minPrice=`, `?maxPrice=`): point to the plain page and are marked `noindex, follow`
- **Language** is now `en-IN` (English, India).
- **Real 404 status codes.** Product and collection pages stream their content, which locks the HTTP status at 200 even for names that don't exist (Next.js adds `noindex`, but Google still files these as "soft 404" mistakes). A small check in `src/proxy.ts` now looks the name up _before_ the page renders and returns a true 404 for unknown products and collections. It keeps a short-lived list of names in memory, re-checks the database for unknown names (at most every 10 seconds, so a just-added product is never wrongly "missing"), and if the database is unreachable it lets the page render instead of showing a false 404.
- **A branded "Page not found" page** (`src/app/not-found.tsx`) with links to browse, search or go home. This also covers part of Phase 9.

## Manual test checklist

1. Open http://localhost:3000/robots.txt: you see `Disallow` lines for cart, checkout, account, orders, wishlist, search, api, and a `Sitemap:` line.
2. Open http://localhost:3000/sitemap.xml: a long list of addresses starting with the home page. It should contain about 218 entries (home, all-products, 15 collections, 201 products) and none for `/cart`, `/account`, etc.
3. Open any product, right-click -> **View page source**, search for `canonical`: it points to that product's own address.
4. Open `/collections/cotton-sarees?sort=price-asc` and view the source: the canonical points to `/collections/cotton-sarees` and there is a `robots` tag with `noindex`. Open `?page=2`: its canonical is itself, with no `noindex`.
5. Search the source of any page for `lang=`: it says `en-IN`.
6. Open `/products/does-not-exist`: a friendly "Page not found" page. In your browser's developer tools (Network tab) the first request shows status **404**. (Before this step it showed 200.)
7. Real pages still open normally (home, a collection, a product, `/collections/all`).

## Tests

- `npm test`: 309 unit tests including the address rules, canonical rules, robots, sitemap (with database failure), the name-cache and the proxy.
- `npm run test:e2e`: browser tests for `robots.txt`, the sitemap (count, uniqueness, nothing private, a sample of its addresses really exist), canonical links, `en-IN`, real 404 statuses, and the not-found page.

## Known gaps / next

- The home page and collections still have generic titles and no descriptions (S2).
- No structured data for the business itself (S3), no share previews or icons (S4), no analytics (S5).
- Old Shopify-style addresses need redirects at launch (`/collections/x/products/y`).
- The address is `http://localhost:3000` until you set `NEXT_PUBLIC_SITE_URL`.
