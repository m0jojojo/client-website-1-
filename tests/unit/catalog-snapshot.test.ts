import { readFileSync } from "node:fs";

type Snap = {
  collections: { handle: string }[];
  products: {
    handle: string;
    title: string;
    variants: { pricePaise: number; compareAtPricePaise: number | null }[];
    collections: { collection: string }[];
  }[];
};
const snap: Snap = JSON.parse(readFileSync("prisma/seed/catalog.json", "utf8"));

describe("seed snapshot integrity", () => {
  it("has unique product and collection handles", () => {
    const ph = snap.products.map((p) => p.handle);
    const ch = snap.collections.map((c) => c.handle);
    expect(new Set(ph).size).toBe(ph.length);
    expect(new Set(ch).size).toBe(ch.length);
  });
  it("every product has a title and at least one variant with a positive integer price", () => {
    for (const p of snap.products) {
      expect(p.title.length).toBeGreaterThan(0);
      expect(p.variants.length).toBeGreaterThan(0);
      for (const v of p.variants) {
        expect(Number.isInteger(v.pricePaise)).toBe(true);
        expect(v.pricePaise).toBeGreaterThan(0);
      }
    }
  });
  it("collection references point at real collections", () => {
    const known = new Set(snap.collections.map((c) => c.handle));
    for (const p of snap.products)
      for (const c of p.collections) expect(known).toContain(c.collection);
  });
});
