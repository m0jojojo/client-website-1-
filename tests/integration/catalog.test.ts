import { getDb } from "@/lib/db";
import {
  getCollectionByHandle,
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
});
