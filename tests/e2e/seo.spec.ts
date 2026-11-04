import { expect, test, type Page } from "@playwright/test";

const hasDb = !!process.env.DATABASE_URL;
const SITE = "http://localhost:3000";

const canonical = (page: Page) => page.locator('link[rel="canonical"]').getAttribute("href");
const robotsMeta = async (page: Page) =>
  (
    await page
      .locator('meta[name="robots"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute("content")))
  ).join(",");

test.describe("robots.txt", () => {
  test("allows the shop, blocks private pages and names the sitemap", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/plain");
    const body = await res.text();
    expect(body).toMatch(/User-Agent: \*/i);
    expect(body).toMatch(/Allow: \//);
    for (const p of [
      "/api/",
      "/cart",
      "/checkout",
      "/account",
      "/orders",
      "/wishlist",
      "/search",
    ]) {
      expect(body).toContain(`Disallow: ${p}`);
    }
    expect(body).toContain(`Sitemap: ${SITE}/sitemap.xml`);
    expect(body).not.toMatch(/Disallow: \/\s*$/m); // the whole site is not blocked
  });
});

test.describe("language and canonical links", () => {
  test("the page language is English (India)", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en-IN");
  });

  test("the home page points to itself", async ({ page }) => {
    await page.goto("/");
    expect(await canonical(page)).toBe(SITE); // the root address, with or without a slash, is the same page
    expect(await robotsMeta(page)).not.toContain("noindex");
  });

  test.describe("catalog pages", () => {
    test.skip(!hasDb, "needs a seeded database");

    test("a product page points to its own address", async ({ page, request }) => {
      const handle = (await (await request.get("/api/products?pageSize=1")).json()).items[0].handle;
      await page.goto(`/products/${handle}`);
      expect(await canonical(page)).toBe(`${SITE}/products/${handle}`);
      expect(await robotsMeta(page)).not.toContain("noindex");
    });

    test("a collection page points to itself; page 2 points to page 2", async ({ page }) => {
      await page.goto("/collections/cotton-sarees");
      expect(await canonical(page)).toBe(`${SITE}/collections/cotton-sarees`);
      expect(await robotsMeta(page)).not.toContain("noindex");
      await page.goto("/collections/cotton-sarees?page=2");
      expect(await canonical(page)).toBe(`${SITE}/collections/cotton-sarees?page=2`);
      expect(await robotsMeta(page)).not.toContain("noindex");
      await page.goto("/collections/cotton-sarees?page=1");
      expect(await canonical(page)).toBe(`${SITE}/collections/cotton-sarees`);
    });

    test("sorted and filtered views point to the plain page and are kept out of Google", async ({
      page,
    }) => {
      for (const query of [
        "sort=price-asc",
        "availability=in-stock",
        "minPrice=500",
        "sort=title-asc&page=2",
        "maxPrice=1500&availability=in-stock",
      ]) {
        await page.goto(`/collections/cotton-sarees?${query}`);
        expect(await canonical(page), query).toBe(`${SITE}/collections/cotton-sarees`);
        expect(await robotsMeta(page), query).toContain("noindex");
      }
    });
  });

  test("private pages stay out of Google", async ({ page }) => {
    for (const path of ["/cart", "/checkout", "/wishlist", "/search?q=cotton", "/account/login"]) {
      await page.goto(path);
      expect(await robotsMeta(page), path).toContain("noindex");
    }
  });
});

test.describe("sitemap.xml", () => {
  test.skip(!hasDb, "needs a seeded database");

  test("lists every public page with full addresses and nothing private", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("xml");
    const xml = await res.text();
    expect(xml.startsWith("<?xml")).toBe(true);
    expect(xml).toContain("<urlset");

    const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const collections = (await (await request.get("/api/collections")).json()).items.length;
    const products = (await (await request.get("/api/products?pageSize=1")).json()).total;

    expect(urls).toHaveLength(2 + collections + products); // home + all-products page + collections + products
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls.every((u) => u.startsWith(`${SITE}/`))).toBe(true);
    expect(urls).toContain(`${SITE}/`);
    expect(urls).toContain(`${SITE}/collections/all`);
    expect(urls).toContain(`${SITE}/collections/cotton-sarees`);
    expect(urls.filter((u) => u.includes("/products/")).length).toBe(products);
    for (const bad of [
      "/cart",
      "/checkout",
      "/account",
      "/orders",
      "/wishlist",
      "/search",
      "/api/",
      "?sort=",
      "?page=",
    ]) {
      expect(
        urls.some((u) => u.includes(bad)),
        bad,
      ).toBe(false);
    }
    expect(xml).toContain("<lastmod>"); // products say when they last changed
  });

  test("every address in the sitemap really exists (sampled)", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const sample = [
      ...urls.filter((u) => !u.includes("/products/")),
      ...urls.filter((u) => u.includes("/products/")).slice(0, 12),
    ];
    for (const u of sample) {
      const res = await request.get(u.replace(SITE, ""));
      expect(res.status(), u).toBe(200);
    }
  });
});

test.describe("real 404 for pages that do not exist", () => {
  test.skip(!hasDb, "needs a seeded database");

  test("missing products and collections answer with HTTP 404 and stay out of Google", async ({
    request,
  }) => {
    for (const path of [
      "/products/does-not-exist",
      "/collections/does-not-exist",
      "/products/no%20such%20thing",
      "/products/%E0%A4%A",
    ]) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(404);
      const html = await res.text();
      expect(html, path).toContain("Page not found");
      expect(html, path).toMatch(/<meta name="robots" content="noindex/);
    }
  });

  test("an address that is not a page at all also gives a 404", async ({ request }) => {
    for (const path of ["/nope", "/products", "/some/deep/path"]) {
      expect((await request.get(path)).status(), path).toBe(404);
    }
  });

  test("real pages still answer 200", async ({ request }) => {
    const handle = (await (await request.get("/api/products?pageSize=1")).json()).items[0].handle;
    for (const path of [
      "/",
      "/collections/all",
      "/collections/cotton-sarees",
      `/products/${handle}`,
      `/products/${handle}/`,
      "/cart",
      "/search",
    ]) {
      expect((await request.get(path)).status(), path).toBe(200);
    }
  });

  test("the not-found page is friendly and has ways forward", async ({ page }) => {
    const res = await page.goto("/products/does-not-exist");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Browse all products" })).toHaveAttribute(
      "href",
      "/collections/all",
    );
    await expect(page.getByRole("link", { name: "Go to the home page" })).toHaveAttribute(
      "href",
      "/",
    );
    await expect(page.getByRole("link", { name: "Search the shop" })).toHaveAttribute(
      "href",
      "/search",
    );
    await expect(page.getByRole("link", { name: "The Block Bagru" }).first()).toBeVisible(); // site header is still there
    await page.getByRole("link", { name: "Browse all products" }).click();
    await expect(page).toHaveURL(/\/collections\/all$/);
  });
});
