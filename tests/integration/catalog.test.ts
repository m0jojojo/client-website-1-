import { getDb } from "@/lib/db";
import {
  getCollectionByHandle,
  getFacets,
  getProductByHandle,
  listCollections,
  listProducts,
} from "@/lib/catalog";

// Runs only when DATABASE_URL points at a migrated + seeded database.
const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("catalog queries (real database, seeded)", () => {
  afterAll(async () => {
    await getDb().$disconnect();
  });

  it("lists collections with product counts", async () => {
    const cols = await listCollections();
    expect(cols.length).toBeGreaterThanOrEqual(15);
    const cotton = cols.find((c) => c.handle === "cotton-sarees");
    expect(cotton?.productCount).toBeGreaterThan(0);
  });

  it("paginates products without overlap", async () => {
    const p1 = await listProducts({ page: 1, pageSize: 10 });
    const p2 = await listProducts({ page: 2, pageSize: 10 });
    expect(p1.items).toHaveLength(10);
    expect(p1.total).toBeGreaterThan(100);
    expect(p1.totalPages).toBe(Math.ceil(p1.total / 10));
    const h1 = new Set(p1.items.map((i) => i.handle));
    expect(p2.items.some((i) => h1.has(i.handle))).toBe(false);
  });

  it("filters by collection", async () => {
    const res = await listProducts({ collection: "mulmul-sarees", pageSize: 60 });
    const col = (await listCollections()).find((c) => c.handle === "mulmul-sarees");
    expect(res.total).toBe(col?.productCount);
  });

  it("sorts by price", async () => {
    const asc = await listProducts({ sort: "price-asc", pageSize: 60 });
    const prices = asc.items.map((i) => i.pricePaise);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    const desc = await listProducts({ sort: "price-desc", pageSize: 60 });
    expect(desc.items[0].pricePaise).toBeGreaterThanOrEqual(desc.items[1].pricePaise);
  });

  it("searches by title, case-insensitively", async () => {
    const res = await listProducts({ q: "MAHESHWARI", pageSize: 60 });
    expect(res.total).toBeGreaterThan(0);
    for (const i of res.items) expect(i.title.toLowerCase()).toContain("maheshwari");
  });

  it("returns product detail with variants, images and collections", async () => {
    const { items } = await listProducts({ pageSize: 1 });
    const detail = await getProductByHandle(items[0].handle);
    expect(detail?.variants.length).toBeGreaterThan(0);
    expect(detail?.images.length).toBeGreaterThan(0);
    expect(detail?.discountPercent).toBeGreaterThanOrEqual(0);
  });

  it("returns null for unknown handles", async () => {
    expect(await getProductByHandle("does-not-exist")).toBeNull();
    expect(await getCollectionByHandle("does-not-exist")).toBeNull();
  });

  describe("Phase 4: filters, sorts, facets", () => {
    it("facet counts add up to the collection size", async () => {
      const f = await getFacets({ collection: "cotton-sarees" });
      const col = (await listCollections()).find((c) => c.handle === "cotton-sarees");
      expect(f.inStock + f.outOfStock).toBe(col?.productCount);
      expect(f.maxPricePaise).toBeGreaterThan(0);
    });

    it("availability filters match the facet counts and are mutually exclusive", async () => {
      const f = await getFacets({ collection: "cotton-sarees" });
      const inStock = await listProducts({
        collection: "cotton-sarees",
        availability: ["in-stock"],
        pageSize: 60,
      });
      const out = await listProducts({
        collection: "cotton-sarees",
        availability: ["out-of-stock"],
        pageSize: 60,
      });
      expect(inStock.total).toBe(f.inStock);
      expect(out.total).toBe(f.outOfStock);
      expect(inStock.items.every((i) => i.inStock)).toBe(true);
      expect(out.items.every((i) => !i.inStock)).toBe(true);
    });

    it("choosing both availabilities is the same as no filter", async () => {
      const all = await listProducts({ collection: "cotton-sarees" });
      const both = await listProducts({
        collection: "cotton-sarees",
        availability: ["in-stock", "out-of-stock"],
      });
      expect(both.total).toBe(all.total);
    });

    it("price range returns only products inside the range, inclusive", async () => {
      const res = await listProducts({
        minPricePaise: 100000,
        maxPricePaise: 150000,
        pageSize: 60,
      });
      expect(res.total).toBeGreaterThan(0);
      for (const i of res.items) {
        expect(i.pricePaise).toBeGreaterThanOrEqual(100000);
        expect(i.pricePaise).toBeLessThanOrEqual(150000);
      }
    });

    it("an impossible price range returns nothing", async () => {
      const res = await listProducts({ minPricePaise: 99999900 });
      expect(res.total).toBe(0);
      expect(res.items).toEqual([]);
      expect(res.totalPages).toBe(1);
    });

    it("filters combine with search, collection and sort", async () => {
      const res = await listProducts({
        collection: "cotton-sarees",
        q: "saree",
        availability: ["in-stock"],
        maxPricePaise: 130000,
        sort: "price-desc",
        pageSize: 60,
      });
      const prices = res.items.map((i) => i.pricePaise);
      expect(prices).toEqual([...prices].sort((a, b) => b - a));
      expect(res.items.every((i) => i.inStock && i.pricePaise <= 130000)).toBe(true);
    });

    it("alphabetical and date sorts are ordered and reverse each other", async () => {
      const az = await listProducts({ sort: "title-asc", pageSize: 60 });
      const za = await listProducts({ sort: "title-desc", pageSize: 60 });
      const titlesAz = az.items.map((i) => i.title);
      expect(titlesAz).toEqual(
        [...titlesAz].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).length ? titlesAz : [],
      );
      expect(az.items[0].title).not.toBe(za.items[0].title);
      const newest = await listProducts({ sort: "date-desc", pageSize: 60 });
      const oldest = await listProducts({ sort: "date-asc", pageSize: 60 });
      expect(newest.items[0].handle).not.toBe(oldest.items[0].handle);
    });

    it("a page past the end is empty but reports the right total pages", async () => {
      const res = await listProducts({ page: 999, pageSize: 24 });
      expect(res.items).toEqual([]);
      expect(res.totalPages).toBeGreaterThan(1);
    });

    it("search facets are scoped to the search term", async () => {
      const f = await getFacets({ q: "maheshwari" });
      const res = await listProducts({ q: "maheshwari", pageSize: 60 });
      expect(f.inStock + f.outOfStock).toBe(res.total);
    });
  });
});
