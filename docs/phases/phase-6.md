# Phase 6: Cart and wishlist

## Built

**Cart (saved on the server, in your Neon database)**

- New tables `Cart` and `CartItem` (migration `add_cart`). A cart belongs to one browser through an unguessable cookie (`bagru_cart`: HttpOnly, SameSite=Lax, Secure in production, 30 days). Only a SHA-256 hash of the token is stored.
- **Prices are never stored in the cart.** Every cart view recalculates from current database prices, so a price change or a sold-out item shows up immediately. Sold-out lines are flagged and left out of the total.
- Limits: 10 per item, 50 different items per cart. Adding the same item again increases the quantity.
- API: `GET /api/cart`, `POST /api/cart/items`, `PATCH /api/cart/items/[id]` (quantity 0 removes), `DELETE /api/cart/items/[id]`. Writes check the request's origin, require a JSON body and validate with zod; responses are `no-store`. One shopper cannot touch another's lines.
- **Slide-over drawer**: opens on Add to cart or the header cart icon; item list, quantity steppers, remove, savings, subtotal, Checkout / View cart / Continue shopping. Header cart icon shows the item count.
- **/cart page**: same lines and controls plus an order summary.
- The product page's Add to cart button is now live (shows "Adding...", and shows the server's message if the item just sold out).
- `npm run db:prune-carts [days]` deletes carts untouched for 60+ days (run it occasionally or schedule it later).

**Wishlist (saved in the browser)**

- Heart button on every product card and a labelled "Add to wishlist" button on product pages; header heart with a count; `/wishlist` page (newest first, remove with the heart).
- Stored in `localStorage` (`bagru:wishlist:v1`), shared across tabs, survives reloads, tolerant of corrupted data and blocked storage. Phase 7 moves it into the customer's account at login.
- `/api/products` accepts `handles=a,b,c` (up to 60) so the wishlist page can load its products.

## Run

`npm run dev`, then use the site normally. (Cart needs the database migration applied: already done on your Neon database; for a fresh database run `npm run db:deploy`.)

## Manual test checklist

1. Open a product, click **+** twice, then **Add to cart**: the drawer slides in with quantity 3, a subtotal, "You save", and the header cart shows a badge of 3.
2. In the drawer: **+ / -** change quantity and the total; **Remove** empties it ("Your cart is empty.").
3. Close the drawer (X, Escape or clicking outside), reload the page: the badge is still there (the cart is saved).
4. **View cart** opens `/cart` with the same items and an order summary. Change a quantity there.
5. Add the same product again: still one line, quantity increases (max 10).
6. Open the site in a private/incognito window: the cart is empty (carts are per browser).
7. Open a sold-out product: its button is "Sold out" and disabled.
8. On any collection page click a heart: it turns red, the header heart shows a count. Click the header heart: `/wishlist` shows your items, newest first. Remove one with its heart.
9. Reload and open a second tab: the wishlist is still there.
10. Phone width: drawer fills the screen, cart page stacks, nothing scrolls sideways.
11. **Checkout** goes to `/checkout`, which does not exist yet (Phase 8): expected.
12. Tab through the drawer: focus stays inside it while open, and Escape closes it.

## Automated tests

- `npm test`: 143 unit/component tests (cart provider, drawer, lines, page, add-to-cart, wishlist store/button/page, token and origin checks).
- `npm run test:integration`: 32 database tests (cart rules: totals, limits, clamping, sold-out, price changes, cross-cart safety, pruning).
- `npm run test:e2e`: 136 passing end-to-end tests on desktop and mobile Chrome, including cart/wishlist flows, API validation, cookie flags and accessibility. The cart tests clean up the carts they create.

## Known gaps / decisions

- Checkout is Phase 8; the Checkout buttons link to `/checkout` (404 until then).
- The prepaid 10% discount and shipping are only described in the cart; they are applied at checkout (Phase 8). Taxes are shown as "included".
- Carts are anonymous. Phase 7 attaches a cart to an account at login and merges it with the browser cart; the wishlist is moved into the account at the same time.
- There is no rate limiting on the cart API yet (planned for Phase 11).
- Stock is only "in stock / sold out"; real quantities arrive with orders (Phase 8).
- The seed script wipes catalog tables; because cart lines reference variants, re-seeding also empties carts.
