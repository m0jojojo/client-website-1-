import { collectionSeo } from "@/lib/seo/listing-seo";
import { absoluteUrl, getSiteUrl, isIndexableEnvironment } from "@/lib/seo/site-url";
import type { ListingState } from "@/lib/catalog/params";

const state = (over: Partial<ListingState> = {}): ListingState => ({
  sort: "featured",
  availability: [],
  page: 1,
  ...over,
});

describe("getSiteUrl", () => {
  it("uses NEXT_PUBLIC_SITE_URL and strips any path or trailing slash", () => {
    expect(getSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://theblockbagru.com/" })).toBe(
      "https://theblockbagru.com",
    );
    expect(getSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://theblockbagru.com/shop/x?y=1" })).toBe(
      "https://theblockbagru.com",
    );
    expect(getSiteUrl({ NEXT_PUBLIC_SITE_URL: "  https://shop.example.in  " })).toBe(
      "https://shop.example.in",
    );
  });
  it("falls back through Vercel's production address, the sign-in URL, then localhost", () => {
    expect(
      getSiteUrl({
        VERCEL_PROJECT_PRODUCTION_URL: "bagru.vercel.app",
        BETTER_AUTH_URL: "http://localhost:3000",
      }),
    ).toBe("https://bagru.vercel.app");
    expect(getSiteUrl({ BETTER_AUTH_URL: "https://auth.example.com/" })).toBe(
      "https://auth.example.com",
    );
    expect(getSiteUrl({})).toBe("http://localhost:3000");
  });
  it("ignores values that are not web addresses", () => {
    for (const bad of [
      "",
      "   ",
      "not a url",
      "ftp://files.example.com",
      "javascript:alert(1)",
      "theblockbagru.com",
    ]) {
      expect(getSiteUrl({ NEXT_PUBLIC_SITE_URL: bad })).toBe("http://localhost:3000");
    }
    expect(
      getSiteUrl({ NEXT_PUBLIC_SITE_URL: "nonsense", BETTER_AUTH_URL: "https://ok.example.com" }),
    ).toBe("https://ok.example.com");
  });
  it("builds absolute addresses", () => {
    const env = { NEXT_PUBLIC_SITE_URL: "https://theblockbagru.com" };
    expect(absoluteUrl("/", env)).toBe("https://theblockbagru.com/");
    expect(absoluteUrl("/products/a-b", env)).toBe("https://theblockbagru.com/products/a-b");
    expect(absoluteUrl("/sitemap.xml", env)).toBe("https://theblockbagru.com/sitemap.xml");
  });
});

describe("isIndexableEnvironment", () => {
  it("allows normal and production environments", () => {
    expect(isIndexableEnvironment({})).toBe(true);
    expect(isIndexableEnvironment({ VERCEL_ENV: "production" })).toBe(true);
  });
  it("blocks Vercel previews, development deployments and an explicit switch", () => {
    expect(isIndexableEnvironment({ VERCEL_ENV: "preview" })).toBe(false);
    expect(isIndexableEnvironment({ VERCEL_ENV: "development" })).toBe(false);
    expect(isIndexableEnvironment({ NEXT_PUBLIC_ALLOW_INDEXING: "false" })).toBe(false);
    expect(
      isIndexableEnvironment({ VERCEL_ENV: "production", NEXT_PUBLIC_ALLOW_INDEXING: "false" }),
    ).toBe(false);
  });
});

describe("collectionSeo", () => {
  const base = "/collections/cotton-sarees";
  it("a plain collection page points to itself and is indexed", () => {
    expect(collectionSeo(base, state())).toEqual({ canonicalPath: base, noindex: false });
  });
  it("page 1 spelled '?page=1' still points to the plain address", () => {
    expect(collectionSeo(base, state({ page: 1 })).canonicalPath).toBe(base);
  });
  it("later pages point to themselves and stay indexed", () => {
    expect(collectionSeo(base, state({ page: 3 }))).toEqual({
      canonicalPath: `${base}?page=3`,
      noindex: false,
    });
  });
  it("sorted views point to the plain page and are kept out of the index", () => {
    expect(collectionSeo(base, state({ sort: "price-asc" }))).toEqual({
      canonicalPath: base,
      noindex: true,
    });
    expect(collectionSeo(base, state({ sort: "title-desc", page: 2 }))).toEqual({
      canonicalPath: base,
      noindex: true,
    });
  });
  it("every kind of filter does the same", () => {
    for (const f of [
      { availability: ["in-stock" as const] },
      { minPrice: 500 },
      { maxPrice: 2000 },
      { minPrice: 0 },
    ]) {
      expect(collectionSeo(base, state(f))).toEqual({ canonicalPath: base, noindex: true });
    }
  });
});
