# Phase 4: Collection pages, filters, sorting and search

## Built

- **Collection pages** `/collections/[handle]` (including a virtual `/collections/all` with all 201 products): title, product count, 24 products per page, filters, sorting, numbered pagination, empty state, page title from the collection name.
- **Search page** `/search?q=...` with the same filters, sorting and pagination (marked `noindex`). With no query it shows a search box.
- **Header search** (magnifier icon): opens a search box with live suggestions (up to 6 products with prices, after 2+ characters, debounced 250 ms, stale requests cancelled), a "See all results" link, Enter to open the full results page, Escape or outside click to close.
- **Filters**: Availability (In stock / Out of stock, with counts) and Price range (rupees). Active filters appear as removable chips plus "Remove all".
- **Sorting** (7 options): Featured, A-Z, Z-A, Price low-high, Price high-low, Date old-new, Date new-old. "Featured" currently equals newest first (no manual merchandising data yet).
- **State lives in the URL** (`?sort=price-asc&availability=in-stock&minPrice=500&page=2`), so pages are shareable, the back button works, and the filters work as a plain HTML form without JavaScript.
- **JSON API** extended: `/api/products` and `/api/collections/[handle]` accept `availability` (repeatable), `minPrice`, `maxPrice` (rupees) and the new `sort` values; bad values return 400.
- On phones the filters are behind a "Filter and sort" button; on desktop they are a sidebar.

## Run

`npm run dev`, open http://localhost:3000/collections/cotton-sarees

## Manual test checklist

1. Home page: click a category tile (e.g. Mulmul Sarees) and "View all" under a carousel. They now open real collection pages.
2. `/collections/cotton-sarees` shows "67 products", 24 cards and pages 1-3. Page 2 shows different products; the browser Back button returns to page 1.
3. Change **Sort by**. The page reloads at once. Price low to high starts at the cheapest (₹899-₹1,099 range for sarees).
4. Tick **In stock** and press **Apply**: the count drops to 50 and no card says "Sold out". The "In stock x" chip removes the filter.
5. Enter a price range such as 1000 to 1100, press Apply: all prices are within it. A range like 900000 shows "No products match your filters" with a way back.
6. `/collections/all` shows 201 products. `/collections/nope` shows the 404 page.
7. Click the magnifier in the header, type "mulmul": suggestions appear after a moment. Click one (goes to a product page that does not exist yet, Phase 5), or press Enter to see the results page.
8. On the search results page, apply filters: your search word stays in the URL and the heading.
9. Phone width (or devtools): filters are hidden until you tap "Filter and sort"; no sideways scrolling; Tab key shows focus rings.
10. `/api/products?availability=maybe` returns 400.

## Automated tests

- `npm test`: 87 unit/component tests (URL parsing round-trip, pagination window, filter form, chips, search box debounce/abort/keyboard, query builder).
- `npm run test:integration`: 16 tests against the real database (facet counts, availability and price filters, sorts, search, out-of-range pages).
- `npm run test:e2e`: 68 passing end-to-end tests on desktop and mobile Chrome (collection, filters, pagination, search, header suggestions, API, accessibility with axe). Database tests are skipped when `DATABASE_URL` is not set.

## Known gaps / decisions

- Product links go to `/products/<handle>`, which does not exist until Phase 5 (404).
- Unknown collections render the 404 page with `noindex` but the HTTP status is 200, because Next.js streams this page. Search engines still treat it as not-indexable. A true 404 status can be added later with `generateStaticParams`.
- Price filter matches a product if any variant is in range, while the card shows the cheapest in-stock variant. All current products have one variant, so these agree.
- Price sort and the in-memory pass are fine for about 200 products; revisit if the catalog grows to thousands.
- Search is a case-insensitive "title contains" match (no typo tolerance or description search).
- Page cache: collection and search pages render per request. Caching can be added in Phase 11.
