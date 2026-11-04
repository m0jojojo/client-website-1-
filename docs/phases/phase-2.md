# Phase 2: Data model and catalog backend

## Built

- Prisma 7.10.1 schema (`prisma/schema.prisma`): Collection, Product, Variant, ProductImage, CollectionProduct. Prices are integer paise.
- Neon serverless Postgres via `@prisma/adapter-neon` (`src/lib/db.ts`, lazy singleton; no DB needed to import or build).
- Catalog data layer (`src/lib/catalog`): list/filter/sort/search/paginate products, product detail, collections, discount % and rupee formatting.
- JSON API: `GET /api/products` (`collection`, `q`, `sort`, `page`, `pageSize`), `GET /api/products/[handle]`, `GET /api/collections`, `GET /api/collections/[handle]`. Invalid params return 400, unknown handles 404.
- Seed: `prisma/seed/catalog.json` (15 collections, 201 products from the live store; text and prices only, all images are a placeholder). Regenerate with `scripts/build-catalog-snapshot.py`.

## Set up your database (one-time, you do this)

1. Create a free project at https://neon.tech (region close to your users, e.g. Singapore/Mumbai if offered).
2. Copy the pooled connection string.
3. `cp .env.example .env.local` and paste it as `DATABASE_URL` (never commit `.env.local`; it is git-ignored).
4. `npm run db:migrate -- --name init` creates the tables.
5. `npm run db:seed` loads the catalog.

## Run and test

- `npm run dev`, then open http://localhost:3000/api/collections and http://localhost:3000/api/products?pageSize=5
- `npm test` (unit, no database needed) and `npm run test:integration` (needs the seeded database).

## Manual test checklist

1. `/api/collections` returns 15 collections with counts (New Arrivals 134, Cotton Sarees 67 ...).
2. `/api/products?pageSize=5` returns 5 items and `total` 201; `?page=2` returns different items.
3. `/api/products?collection=mulmul-sarees` returns 5 items; `?q=maheshwari` only Maheshwari titles.
4. `/api/products?sort=price-asc` is ascending by `pricePaise`.
5. `/api/products/<any handle from the list>` returns variants, images, collections.
6. `/api/products/nope` returns 404; `/api/products?page=0` returns 400.

## Known gaps / decisions

- `inStock` is a boolean (what the live feed provides). Real stock quantities are decided in Phase 8 with checkout.
- Price sorting is done in memory (catalog is small, ~200 items); revisit if the catalog grows large.
- Search is a simple case-insensitive title match; richer search comes in Phase 4.
- Seed wipes and reloads catalog tables; never run it against a database holding real orders.
- Prisma is pinned to 7.10.1 because the npm `latest` tag currently points at an 8.0 release candidate.
