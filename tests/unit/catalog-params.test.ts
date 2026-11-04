import { listingQuery, paramsToOptions, parseListingState, toRaw } from "@/lib/catalog/params";
import { parseProductListParams } from "@/lib/catalog/params";

const parse = (qs: string) => parseProductListParams(new URLSearchParams(qs));

describe("parseProductListParams", () => {
  it("applies defaults", () => {
    const r = parse("");
    expect(r.success && r.data).toMatchObject({
      sort: "featured",
      page: 1,
      pageSize: 24,
      availability: [],
    });
  });
  it("coerces numbers and accepts known sorts", () => {
    const r = parse("page=2&pageSize=12&sort=price-asc&collection=cotton-sarees&q=blue");
    expect(r.success && r.data).toEqual({
      page: 2,
      pageSize: 12,
      sort: "price-asc",
      collection: "cotton-sarees",
      q: "blue",
      availability: [],
    });
  });
  it.each([
    "page=0",
    "page=abc",
    "pageSize=1000",
    "sort=random",
    "minPrice=-5",
    "availability=maybe",
  ])("rejects %s", (qs) => {
    expect(parse(qs).success).toBe(false);
  });
});

describe("listing params (API)", () => {
  it("accepts repeated availability and rupee price bounds", () => {
    const r = parse("availability=in-stock&availability=out-of-stock&minPrice=500&maxPrice=1500");
    expect(r.success && r.data).toMatchObject({
      availability: ["in-stock", "out-of-stock"],
      minPrice: 500,
      maxPrice: 1500,
    });
  });
  it("treats blank form fields as not set", () => {
    const r = parse("minPrice=&maxPrice=&q=&availability=");
    expect(r.success && r.data).toMatchObject({ availability: [] });
    expect(r.success && r.data.minPrice).toBeUndefined();
    expect(r.success && r.data.q).toBeUndefined();
  });
  it("converts rupees to paise for the data layer", () => {
    const r = parse("minPrice=500&maxPrice=1500");
    expect(r.success && paramsToOptions(r.data)).toMatchObject({
      minPricePaise: 50000,
      maxPricePaise: 150000,
    });
  });
});

describe("parseListingState (pages)", () => {
  it("falls back to defaults on bad input instead of failing", () => {
    const s = parseListingState({
      sort: "nope",
      page: "abc",
      minPrice: "-3",
      availability: ["x", "in-stock"],
    });
    expect(s).toMatchObject({ sort: "featured", page: 1, availability: ["in-stock"] });
    expect(s.minPrice).toBeUndefined();
  });
  it("swaps min and max when reversed", () => {
    expect(parseListingState({ minPrice: "2000", maxPrice: "500" })).toMatchObject({
      minPrice: 500,
      maxPrice: 2000,
    });
  });
  it("handles a single availability string and de-duplicates", () => {
    expect(parseListingState({ availability: "out-of-stock" }).availability).toEqual([
      "out-of-stock",
    ]);
    expect(parseListingState({ availability: ["in-stock", "in-stock"] }).availability).toEqual([
      "in-stock",
    ]);
  });
});

describe("listingQuery", () => {
  it("omits defaults so URLs stay clean", () => {
    expect(listingQuery({ sort: "featured", page: 1, availability: [] })).toBe("");
  });
  it("round-trips through parseListingState", () => {
    const state = {
      q: "cotton saree",
      sort: "price-asc" as const,
      availability: ["in-stock" as const],
      minPrice: 500,
      maxPrice: 1500,
      page: 3,
    };
    const qs = new URLSearchParams(listingQuery(state));
    expect(parseListingState(toRaw(qs))).toEqual(state);
  });
});
