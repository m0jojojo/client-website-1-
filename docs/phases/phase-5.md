# Phase 5: Product detail page

## Built

- **Product page** `/products/[handle]`: breadcrumbs (Home / collection / product), image gallery, title, price block, purchase panel, trust badges, description, "You may also like" carousel.
- **Gallery**: main image, "Enlarge" dialog (Escape or Close to dismiss). When a product has several images it also shows a counter, previous/next arrows, thumbnails and left/right arrow keys. All products currently have one placeholder image.
- **Price block**: sale price, struck-through regular price, `% OFF` badge, "Taxes included.", and the 10% prepaid-order banner (as on the live site).
- **Purchase panel**: option picker (only shown when a product has more than one variant; price follows the selected variant), quantity stepper (1 to 10, typed values are clamped), Add to cart button. Sold-out products show a disabled "Sold out" button.
- **Add to cart** is not connected yet: clicking shows "The cart is coming soon". Phase 6 passes an `onAddToCart` handler into `PurchasePanel`.
- **Trust badges**: authentic hand print, 7-day easy returns, free shipping, COD available.
- **Description**: the product text from the database, split into paragraphs (no invented fabric/colour/wash-care fields).
- **Related products**: up to 8 products from the product's most specific collection (in stock first, newest first), topped up with newest products for small collections; never includes the product itself.
- **SEO**: page title and description from the product, Open Graph tags, schema.org `Product` structured data (name, price in INR, availability). Unknown products show the 404 page.

## Run

`npm run dev`, open any product, e.g. http://localhost:3000/products/tea-print-cotton-mulmul-saree

## Manual test checklist

1. From a collection page, click a product card: the product page opens with the right title and price (e.g. ₹899, ~~₹1,499~~, 40% OFF).
2. Breadcrumb: "Mulmul Sarees" goes back to that collection; "Home" goes to the home page.
3. Quantity: "-" is disabled at 1; "+" increases; typing 50 becomes 10 and "+" is disabled; typing 0 or letters becomes 1.
4. Click **Add to cart**: a "cart is coming soon" message appears (expected until Phase 6).
5. Click **Enlarge**: a dialog opens; Escape or Close dismisses it.
6. Scroll to **You may also like**: scroll sideways or use the arrows; clicking a card opens that product.
7. Find a sold-out product (collection page, filter "Out of stock"): the button says **Sold out** and is disabled, with no discount badge on its card.
8. `/products/does-not-exist` shows the 404 page.
9. Phone width: layout stacks (image, price, button, details), no sideways scrolling, Tab shows focus rings.
10. Header search: type "mulmul", click a suggestion: it opens a working product page.
11. (Optional) View page source and search for `application/ld+json` to see the structured data.

## Automated tests

- `npm test`: 106 unit/component tests (purchase panel, gallery, description, breadcrumbs, JSON-LD safety, helpers).
- `npm run test:integration`: 20 database tests (related products rules).
- `npm run test:e2e`: 92 passing end-to-end tests on desktop and mobile (product page flows, structured data, accessibility with axe, no horizontal scroll).

## Known gaps / decisions

- Add to cart does nothing yet (Phase 6). There is no wishlist button on the product page yet (Phase 6, as the live site has none either).
- Only placeholder images exist, so the multi-image gallery is covered by unit tests but not visible in the browser until real photos are added.
- Structured data has no image URL yet because there are no real images or a configured site URL.
- On a missing product, the browser tab title may read either "Product not found" or Next.js's own "404: This page could not be found." (Next.js controls this; both are correct.) As with collections, the HTTP status is 200 for the 404 page because the page streams.
- The live site's hand-block vs machine-print comparison and reviews section are not included (your choice).
