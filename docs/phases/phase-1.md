# Phase 1: Design system and layout shell

## Built

- Design tokens in `src/app/globals.css` (DM Sans, near-black/white, navy accent `#1d3463`, light grey surface), taken from the live store's theme.
- UI primitives: `Button`, `ButtonLink`, `Card` (`src/components/ui`).
- Layout: `PromoStrip`, `Header` (desktop dropdowns for Sarees and Suits, mobile menu, search/account/wishlist/cart links), `Footer`, floating `WhatsAppButton` (`src/components/layout`).
- Site config and nav data in `src/lib/site.ts` (categories copied from the live nav).
- Skip-to-content link, focus styles.

## Run

`npm run dev`, open http://localhost:3000. Resize the window below 1024px to see the mobile menu.

## Manual test checklist

1. Promo strip shows at the very top; header stays at the top while scrolling.
2. Desktop: hover or click "Sarees" lists 6 categories and "Suits" lists 4; Escape or clicking elsewhere closes it.
3. Mobile width: hamburger opens a menu; Sarees and Suits expand; links close the menu.
4. Footer shows quick links, policies, contact details, GSTIN.
5. Green WhatsApp button is fixed bottom-right and opens wa.me in a new tab.
6. Press Tab from page load: "Skip to content" appears first; focus rings are visible.
7. Links go to routes that do not exist yet (404). Expected until later phases.

## Automated tests

`npm test` (13 unit/component tests), `npm run test:e2e` (12 e2e incl. axe a11y and no-horizontal-scroll; 2 are skipped per device by design).

## Known gaps / decisions

- Icons are text glyphs for now; replaced by an icon set later.
- WhatsApp number is a placeholder; set `NEXT_PUBLIC_WHATSAPP_NUMBER` (digits, with country code).
- Copyright year is a constant (Next.js 16 rejects `new Date()` during prerender).
- Cart/wishlist count badges arrive in Phase 6.
