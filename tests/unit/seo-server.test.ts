// @vitest-environment node
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  db: {
    collection: { findMany: vi.fn() },
    product: { findMany: vi.fn() },
  },
  handleExists: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ getDb: () => mocks.db }));
vi.mock("next/server", async (orig) => ({
  ...(await orig<typeof import("next/server")>()),
  connection: vi.fn(async () => {}),
}));

import robots, { DISALLOWED_PATHS } from "@/app/robots";
import sitemap from "@/app/sitemap";
import { _resetHandleCache, handleExists } from "@/lib/catalog/handles";

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://theblockbagru.com");
  mocks.db.collection.findMany.mockReset();
  mocks.db.product.findMany.mockReset();
  _resetHandleCache();
});
afterEach(() => vi.unstubAllEnvs());

describe("robots.txt", () => {
  it("allows the shop, blocks private pages and points to the sitemap", () => {
    const r = robots() as {
      rules: { userAgent: string; allow: string; disallow: string[] };
      sitemap: string;
    };
    expect(r.rules.userAgent).toBe("*");
    expect(r.rules.allow).toBe("/");
    expect(r.sitemap).toBe("https://theblockbagru.com/sitemap.xml");
    for (const p of [
      "/api/",
      "/cart",
      "/checkout",
      "/account",
      "/orders",
      "/wishlist",
      "/search",
    ]) {
      expect(r.rules.disallow).toContain(p);
    }
    expect(r.rules.disallow).toEqual(DISALLOWED_PATHS);
    // pages people should find are not blocked
    for (const p of ["/", "/products/x", "/collections/x"]) {
      expect(r.rules.disallow.some((d) => p.startsWith(d))).toBe(false);
    }
  });
  it("blocks everything on preview deployments and has no sitemap there", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(robots()).toEqual({ rules: { userAgent: "*", disallow: "/" } });
  });
  it("blocks everything when indexing is switched off", () => {
    vi.stubEnv("NEXT_PUBLIC_ALLOW_INDEXING", "false");
    expect(robots()).toEqual({ rules: { userAgent: "*", disallow: "/" } });
  });
});

describe("sitemap.xml", () => {
  it("lists the fixed pages, every collection and every published product, with full addresses", async () => {
    mocks.db.collection.findMany.mockResolvedValue([
      { handle: "cotton-sarees", _count: { products: 67 } },
      { handle: "linen-suits", _count: { products: 6 } },
    ]);
    const updated = new Date("2026-10-20T10:00:00Z");
    mocks.db.product.findMany.mockResolvedValue([
      { handle: "tea-print-saree", updatedAt: updated },
      { handle: "kota-doria-suit-(bg30)", updatedAt: updated },
    ]);
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls).toEqual([
      "https://theblockbagru.com/",
      "https://theblockbagru.com/collections/all",
      "https://theblockbagru.com/collections/cotton-sarees",
      "https://theblockbagru.com/collections/linen-suits",
      "https://theblockbagru.com/products/tea-print-saree",
      "https://theblockbagru.com/products/kota-doria-suit-(bg30)",
    ]);
    expect(entries.find((e) => e.url.endsWith("tea-print-saree"))?.lastModified).toEqual(updated);
    expect(new Set(urls).size).toBe(urls.length);
  });
  it("leaves out empty collections", async () => {
    mocks.db.collection.findMany.mockResolvedValue([
      { handle: "cotton-sarees", _count: { products: 3 } },
      { handle: "cotton-linen-sarees", _count: { products: 0 } },
    ]);
    mocks.db.product.findMany.mockResolvedValue([]);
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toContain("https://theblockbagru.com/collections/cotton-sarees");
    expect(urls.some((u) => u.includes("cotton-linen-sarees"))).toBe(false);
  });

  it("asks only for published products and never lists private pages", async () => {
    mocks.db.collection.findMany.mockResolvedValue([]);
    mocks.db.product.findMany.mockResolvedValue([]);
    const urls = (await sitemap()).map((e) => e.url);
    expect(mocks.db.product.findMany.mock.calls[0][0].where).toEqual({ published: true });
    for (const bad of [
      "/cart",
      "/checkout",
      "/account",
      "/orders",
      "/wishlist",
      "/search",
      "/api",
    ]) {
      expect(urls.some((u) => u.includes(bad))).toBe(false);
    }
  });
  it("percent-encodes unusual names", async () => {
    mocks.db.collection.findMany.mockResolvedValue([]);
    mocks.db.product.findMany.mockResolvedValue([
      { handle: "saree with space", updatedAt: new Date() },
    ]);
    expect((await sitemap()).map((e) => e.url)).toContain(
      "https://theblockbagru.com/products/saree%20with%20space",
    );
  });
  it("still returns the fixed pages if the database is unreachable", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.db.collection.findMany.mockRejectedValue(new Error("db down"));
    mocks.db.product.findMany.mockResolvedValue([]);
    expect((await sitemap()).map((e) => e.url)).toEqual([
      "https://theblockbagru.com/",
      "https://theblockbagru.com/collections/all",
    ]);
    spy.mockRestore();
  });
});

describe("handleExists", () => {
  const load = () => {
    mocks.db.product.findMany.mockResolvedValue([{ handle: "p1" }, { handle: "p2" }]);
    mocks.db.collection.findMany.mockResolvedValue([{ handle: "c1" }]);
  };
  it("says yes for known names and no for unknown ones", async () => {
    load();
    expect(await handleExists("products", "p1")).toBe(true);
    expect(await handleExists("collections", "c1")).toBe(true);
    expect(await handleExists("products", "nope")).toBe(false);
    expect(await handleExists("collections", "p1")).toBe(false); // a product is not a collection
    expect(await handleExists("products", "c1")).toBe(false);
  });
  it("answers known names from memory without asking the database again", async () => {
    load();
    await handleExists("products", "p1");
    mocks.db.product.findMany.mockClear();
    for (let i = 0; i < 5; i++) expect(await handleExists("products", "p2")).toBe(true);
    expect(mocks.db.product.findMany).not.toHaveBeenCalled();
  });
  it("re-checks an unknown name soon after, so a just-added product is found", async () => {
    vi.useFakeTimers();
    try {
      load();
      expect(await handleExists("products", "new-one")).toBe(false);
      mocks.db.product.findMany.mockResolvedValue([{ handle: "p1" }, { handle: "new-one" }]);
      expect(await handleExists("products", "new-one")).toBe(false); // within 10s: no database call yet
      vi.advanceTimersByTime(11_000);
      expect(await handleExists("products", "new-one")).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
  it("does not hammer the database when many unknown names are requested", async () => {
    load();
    await handleExists("products", "x0");
    mocks.db.product.findMany.mockClear();
    for (let i = 1; i < 50; i++) await handleExists("products", `x${i}`);
    expect(mocks.db.product.findMany).not.toHaveBeenCalled();
  });
  it("says yes when the database cannot be reached, so no false 404 is shown", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.db.product.findMany.mockRejectedValue(new Error("db down"));
    mocks.db.collection.findMany.mockRejectedValue(new Error("db down"));
    expect(await handleExists("products", "anything")).toBe(true);
    spy.mockRestore();
  });
});

describe("request proxy", () => {
  const run = async (path: string, exists: boolean) => {
    vi.resetModules();
    vi.doMock("@/lib/catalog/handles", () => ({
      handleExists: mocks.handleExists.mockResolvedValue(exists),
    }));
    const { proxy } = await import("@/proxy");
    return proxy(new NextRequest(`http://localhost:3000${path}`));
  };
  const rewrittenTo = (r: Response) => r.headers.get("x-middleware-rewrite");
  const passedThrough = (r: Response) => r.headers.get("x-middleware-next") === "1";

  it("lets existing products and collections through", async () => {
    expect(passedThrough(await run("/products/tea-print-saree", true))).toBe(true);
    expect(passedThrough(await run("/collections/cotton-sarees", true))).toBe(true);
    expect(passedThrough(await run("/products/tea-print-saree/", true))).toBe(true);
  });
  it("sends unknown names to a route that does not exist, which makes Next.js answer 404", async () => {
    for (const p of ["/products/nope", "/collections/nope", "/products/a%20b"]) {
      expect(rewrittenTo(await run(p, false))).toBe("http://localhost:3000/_missing");
    }
  });
  it("always lets the whole-catalog page through without asking the database", async () => {
    const r = await run("/collections/all", false);
    expect(passedThrough(r)).toBe(true);
    expect(mocks.handleExists).not.toHaveBeenCalled();
  });
  it("treats a broken percent-encoding as not found, and passes other paths straight through", async () => {
    expect(rewrittenTo(await run("/products/%E0%A4%A", false))).toBe(
      "http://localhost:3000/_missing",
    );
    expect(passedThrough(await run("/products/a/b", false))).toBe(true); // not a product address
    expect(passedThrough(await run("/cart", false))).toBe(true);
  });
  it("only runs on product and collection addresses", async () => {
    const { config } = await import("@/proxy");
    expect(config.matcher).toEqual(["/products/:handle", "/collections/:handle"]);
  });
});
