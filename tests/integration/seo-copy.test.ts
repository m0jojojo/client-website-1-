import { getDb } from "@/lib/db";
import { DESCRIPTION_MAX, collectionSeo, productSeo } from "@/lib/seo/copy";

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("search-result text for the real catalog", () => {
  afterAll(async () => {
    await getDb().$disconnect();
  });

  async function products() {
    const rows = await getDb().product.findMany({
      where: { published: true },
      include: { variants: { orderBy: { pricePaise: "asc" } } },
    });
    const twins = new Map<string, string[]>();
    for (const p of rows) {
      const key = p.title.trim().toLowerCase();
      twins.set(key, [...(twins.get(key) ?? []), p.handle]);
    }
    return rows.map((p) => ({
      handle: p.handle,
      title: p.title,
      description: p.description,
      pricePaise: p.variants[0].pricePaise,
      seo: productSeo({
        title: p.title,
        handle: p.handle,
        pricePaise: p.variants[0].pricePaise,
        description: p.description,
        twinHandles: twins.get(p.title.trim().toLowerCase()),
      }),
    }));
  }

  it("every product has its own page title, even where the stored names repeat", async () => {
    const all = await products();
    const titles = all.map((p) => p.seo.title);
    const dupes = titles.filter((t, i) => titles.indexOf(t) !== i);
    expect(dupes, `duplicate titles: ${dupes.join(" | ")}`).toEqual([]);
    expect(all.length).toBeGreaterThan(150);
  });

  it("every product has its own description, although many share the same page text", async () => {
    const all = await products();
    const descs = all.map((p) => p.seo.description);
    const dupes = descs.filter((d, i) => descs.indexOf(d) !== i);
    expect(dupes, `duplicate descriptions: ${dupes.length}`).toEqual([]);
    // the page text really is shared widely, which is the reason the search text is built per product
    expect(new Set(all.map((p) => p.description)).size).toBeLessThan(all.length / 2);
  });

  it("titles and descriptions are within length limits and free of mistakes", async () => {
    for (const p of await products()) {
      const { title, description } = p.seo;
      expect(title.length, title).toBeGreaterThan(10);
      expect(title.length, title).toBeLessThanOrEqual(75);
      expect(description.length, p.handle).toBeGreaterThanOrEqual(60);
      expect(description.length, p.handle).toBeLessThanOrEqual(DESCRIPTION_MAX);
      for (const text of [title, description]) {
        expect(text, p.handle).not.toMatch(/undefined|NaN|null|\[object/i);
        expect(text, p.handle).not.toMatch(/\s{2,}/);
        expect(text, p.handle).not.toMatch(/Product Details/i);
      }
      // no shouting: no run of 6+ capitals except short product codes
      expect(title.replace(/\b[A-Z]{2,5}\d*\b/g, ""), title).not.toMatch(/[A-Z]{6,}/);
      expect(description.startsWith("Buy "), p.handle).toBe(true);
      expect(description).toMatch(/₹[\d,]+/);
    }
  });

  it("the four groups of repeated names are now told apart", async () => {
    const all = await products();
    const pick = (prefix: string) =>
      all.filter((p) => p.handle.startsWith(prefix)).map((p) => p.seo.title);
    const geo = pick("geometrical-printed-mulcotton-saree");
    expect(new Set(geo).size).toBe(geo.length);
    expect(geo.length).toBe(3);
    const nashpal = pick("nashpal-dyes-mulcotton-saree-102").concat(
      pick("nashpal-dyes-mulcotton-saree-1018"),
    );
    expect(new Set(nashpal).size).toBe(nashpal.length);
    const maheshwari = all
      .filter((p) => /maheshwari-silk-saree-bgpt-113[16]$/.test(p.handle))
      .map((p) => p.seo.title);
    expect(maheshwari.length).toBe(2);
    expect(new Set(maheshwari).size).toBe(2);
  });

  it("every collection has a title and description, and the empty ones are known", async () => {
    const cols = await getDb().collection.findMany({
      include: { _count: { select: { products: true } } },
    });
    const seen = new Set<string>();
    for (const c of cols) {
      const seo = collectionSeo({
        handle: c.handle,
        title: c.title,
        productCount: c._count.products,
      });
      expect(seo.title.length, seo.title).toBeLessThanOrEqual(65);
      expect(seo.description.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
      expect(seo.description).not.toMatch(/undefined|NaN/);
      expect(seen.has(seo.title), seo.title).toBe(false);
      seen.add(seo.title);
    }
    const empty = cols
      .filter((c) => c._count.products === 0)
      .map((c) => c.handle)
      .sort();
    expect(empty).toEqual(["cotton-linen-sarees", "nashpal-dyes-mul-cotton-sarees"]);
  });
});
