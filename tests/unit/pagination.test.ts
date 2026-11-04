import { pageWindow } from "@/lib/catalog/pagination";
import { buildWhere, orderByFor } from "@/lib/catalog/queries";

describe("pageWindow", () => {
  it("shows a single page for one page of results", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
  });
  it("shows all pages when few", () => {
    expect(pageWindow(2, 4)).toEqual([1, 2, 3, 4]);
  });
  it("adds gaps around the current page in long lists", () => {
    expect(pageWindow(1, 12)).toEqual([1, 2, null, 12]);
    expect(pageWindow(6, 12)).toEqual([1, null, 5, 6, 7, null, 12]);
    expect(pageWindow(12, 12)).toEqual([1, null, 11, 12]);
  });
  it("fills a one-page gap instead of showing an ellipsis", () => {
    expect(pageWindow(4, 8)).toEqual([1, 2, 3, 4, 5, null, 8]);
  });
});

describe("orderByFor", () => {
  it("maps each DB-side sort to an order", () => {
    expect(orderByFor("title-asc")[0]).toEqual({ title: "asc" });
    expect(orderByFor("title-desc")[0]).toEqual({ title: "desc" });
    expect(orderByFor("date-asc")[0]).toEqual({ createdAt: "asc" });
    expect(orderByFor("date-desc")[0]).toEqual({ createdAt: "desc" });
    expect(orderByFor("featured")[0]).toEqual({ createdAt: "desc" });
  });
});

describe("buildWhere", () => {
  it("always limits to published products", () => {
    expect(buildWhere({})).toEqual({ published: true });
  });
  it("adds an in-stock filter only when exactly one availability is chosen", () => {
    expect(buildWhere({ availability: ["in-stock"] }).AND).toEqual([
      { variants: { some: { inStock: true } } },
    ]);
    expect(buildWhere({ availability: ["out-of-stock"] }).AND).toEqual([
      { variants: { none: { inStock: true } } },
    ]);
    expect(buildWhere({ availability: ["in-stock", "out-of-stock"] }).AND).toBeUndefined();
  });
  it("adds inclusive price bounds in paise", () => {
    expect(buildWhere({ minPricePaise: 50000, maxPricePaise: 150000 }).AND).toEqual([
      { variants: { some: { pricePaise: { gte: 50000, lte: 150000 } } } },
    ]);
    expect(buildWhere({ maxPricePaise: 100 }).AND).toEqual([
      { variants: { some: { pricePaise: { lte: 100 } } } },
    ]);
  });
  it("scopes by collection handle and case-insensitive title", () => {
    const w = buildWhere({ collection: "cotton-sarees", q: "blue" });
    expect(w.collections).toEqual({ some: { collection: { handle: "cotton-sarees" } } });
    expect(w.title).toEqual({ contains: "blue", mode: "insensitive" });
  });
});
