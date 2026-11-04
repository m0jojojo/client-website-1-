# SEO step S2: Page titles and descriptions

## What was added

Every public page now has its own title (the blue link in Google) and description (the grey text under it), written by rules in `src/lib/seo/copy.ts`.

| Page                | Title                                                                                      | Description                                                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home                | `Hand Block Print Sarees & Suits from Bagru \| The Block Bagru`                            | Bagru/Ajrakh sarees and suits from Rajasthan, free shipping across India                                                                                         |
| Collection          | `Buy Cotton Sarees Online \| The Block Bagru`                                              | "Shop 67 cotton sarees with traditional Bagru block prints. Free shipping across India, COD available, 10% off on prepaid orders." (uses the real product count) |
| New Arrivals / All  | `New Arrivals: Hand Block Printed Sarees & Suits`, `All Hand Block Printed Sarees & Suits` | Counts and the same shipping line                                                                                                                                |
| Collection, page 2+ | `Buy Cotton Sarees Online (Page 2) \| The Block Bagru`                                     | Mentions "page 2", so each page is distinct                                                                                                                      |
| Product             | The product name, e.g. `Tea Print Cotton Mulmul Saree \| The Block Bagru`                  | "Buy {name} online for ₹899." plus the first sentence of the product's own text; adds "Free shipping across India, COD available." when there is room            |

Details:

- Titles stay within about 60 characters (the shop name is dropped from very long product titles rather than being cut off by Google). Descriptions stay within 158 characters and are cut at a whole word.
- **ALL CAPS names** (108 of 201 products) become Title Case in titles and descriptions; product codes such as `BG24` and `BGPT` stay in capitals. The product's own heading on the page is not changed.
- **Products with an identical name** (9 products in 4 groups, e.g. three "Geometrical Printed Mulcotton Saree") would get identical titles. The first keeps the plain name and the others get a short tag from their own address, e.g. `Geometrical Printed Mulcotton Saree (Ref 2)`. Names are never altered otherwise, so the search title always matches the page heading.
- **Empty collections** (Cotton Linen Sarees, Nashpal Dyes Mul Cotton Sarees have no products) are kept out of the sitemap and marked `noindex`, since a page with nothing on it hurts rather than helps.
- Product pages also set the matching share-preview title and description (`og:title`, `og:description`).
- Sorted/filtered collection views remain `noindex` with a canonical link to the plain collection (S1).

## What I found in your catalog (worth fixing at the source)

1. **Product text is heavily repeated.** 176 of 201 products share just 23 description texts. Google sees the same paragraph on many pages, which weakens each page. I made the _search-result_ descriptions unique by leading with the product's name and price, but the page text itself still repeats. Writing a short, unique paragraph per product (fabric, print, colour, size, care) is the single best content improvement.
2. **Some product names don't match their address.** For example 26 "Nashpal" and a few other products have a number in the name that differs from the number in the address (name says `1022`, address ends `-1024`). I left the names exactly as stored. Please check which number is right on the shop floor, and fix the names (an admin screen arrives in Phase 10).
3. **Four groups share an identical name** (listed above). Giving each a distinct name would be better than the "(Ref …)" tag.
4. **Two empty collections** (above): add products or remove them.

## Manual test checklist

1. Open the home page and look at the browser tab: `Hand Block Print Sarees & Suits from Bagru | The Block Bagru`.
2. Open `/collections/cotton-sarees`: tab says `Buy Cotton Sarees Online | The Block Bagru`. Open `?page=2`: the tab says `(Page 2)`.
3. Open a few products (especially one that was in capitals): the tab shows a readable name, and it matches the big heading on the page.
4. Open `/products/geometrical-printed-mulcotton-saree`, `-1` and `-2`: three different tab titles.
5. Right-click a page -> **View page source** and search for `description`: one short sentence with the product name and price. Search for `og:title`: same text as the title.
6. Open `/collections/cotton-linen-sarees` (empty): it still opens, but the source contains `noindex`. It is not in `/sitemap.xml`.

## Tests

- `npm test`: 338 unit tests, including the wording rules (capitals, twins, length limits, missing text).
- `npm run test:integration`: 76 database tests, which build the title and description for **all 201 real products and all 15 collections** and check every one is unique, within length limits, free of mistakes, and not shouting in capitals.
- `npm run test:e2e`: 42 SEO browser tests on the real pages, including a sample of 18 products and the nine formerly identical ones.

## Not covered here

Keyword-driven rewording (parked until keyword research), real photos and their alt text, structured data (S3), share images (S4), analytics (S5).
