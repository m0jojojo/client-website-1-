import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const hasDb = !!process.env.DATABASE_URL;
test.skip(!hasDb, "needs DATABASE_URL pointing at a seeded database");

type Pg = import("@playwright/test").Page;

/** On phones the filters sit behind a toggle; on desktop they are always visible. */
async function openFilters(page: Pg) {
  await page.getByRole("complementary", { name: "Filters" }).waitFor({ state: "attached" });
  const toggle = page.getByRole("button", { name: /Filter and sort/ });
  if (await toggle.isVisible()) await toggle.click();
}

const cards = (page: Pg) =>
  page.getByRole("region", { name: "Products", exact: true }).getByRole("article");

test.describe("collection page", () => {
  test("shows title, count, a full first page and pagination", async ({ page }) => {
    await page.goto("/collections/cotton-sarees");
    await expect(page.getByRole("heading", { level: 1, name: "Cotton Sarees" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "products" })).toHaveText(
      "67 products",
    );
    await expect(cards(page)).toHaveCount(24);
    await expect(page.getByRole("navigation", { name: "Pagination" })).toBeVisible();
  });

  test("pagination goes to page 2 with different products and a shareable URL", async ({
    page,
  }) => {
    await page.goto("/collections/cotton-sarees");
    const first = await cards(page).first().getByRole("heading").textContent();
    await page.getByRole("link", { name: "Page 2" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByRole("link", { name: "Page 2" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(await cards(page).first().getByRole("heading").textContent()).not.toBe(first);
    await page.goBack();
    await expect(page).not.toHaveURL(/page=2/);
  });

  test("an out-of-range page redirects to the last page", async ({ page }) => {
    await page.goto("/collections/cotton-sarees?page=999");
    await expect(page).toHaveURL(/page=3/);
    await expect(cards(page)).toHaveCount(19);
  });

  test("sorting by price low to high orders the cards", async ({ page }) => {
    await page.goto("/collections/mulmul-sarees");
    await openFilters(page);
    await page.getByRole("combobox", { name: /Sort by/ }).selectOption("price-asc");
    await expect(page).toHaveURL(/sort=price-asc/);
    await expect(cards(page).first()).toBeVisible();
    const prices = await cards(page).locator("p span.font-semibold").allTextContents();
    const nums = prices.map((p) => Number(p.replace(/[^\d]/g, "")));
    expect(nums.length).toBeGreaterThan(1);
    expect(nums).toEqual([...nums].sort((a, b) => a - b));
  });

  test("In stock filter shows only in-stock products and a removable chip", async ({ page }) => {
    await page.goto("/collections/cotton-sarees");
    await openFilters(page);
    await page.getByLabel(/^In stock/).check();
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page).toHaveURL(/availability=in-stock/);
    await expect(page.getByText("Sold out")).toHaveCount(0);
    await page
      .getByRole("list", { name: "Active filters" })
      .getByRole("link", { name: /^In stock/ })
      .click();
    await expect(page).not.toHaveURL(/availability/);
  });

  test("price filter limits results and shows a chip", async ({ page }) => {
    await page.goto("/collections/cotton-sarees");
    await openFilters(page);
    await page.getByLabel("Minimum price in rupees").fill("1000");
    await page.getByLabel("Maximum price in rupees").fill("1100");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page).toHaveURL(/minPrice=1000&maxPrice=1100/);
    const prices = await cards(page).locator("p span.font-semibold").allTextContents();
    for (const p of prices) {
      const n = Number(p.replace(/[^\d]/g, ""));
      expect(n).toBeGreaterThanOrEqual(1000);
      expect(n).toBeLessThanOrEqual(1100);
    }
    await expect(page.getByRole("list", { name: "Active filters" })).toContainText(
      "₹1,000 – ₹1,100",
    );
  });

  test("filters with no matches show the empty state, and Clear returns results", async ({
    page,
  }) => {
    await page.goto("/collections/cotton-sarees?minPrice=900000");
    await expect(page.getByText("No products match your filters.")).toBeVisible();
    await page.getByRole("link", { name: "Clear all filters" }).click();
    await expect(cards(page)).toHaveCount(24);
  });

  test("the virtual 'all' collection lists the whole catalog", async ({ page }) => {
    await page.goto("/collections/all");
    await expect(page.getByRole("heading", { level: 1, name: "All Products" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "products" })).toHaveText(
      "201 products",
    );
  });

  test("unknown collections show the not-found page", async ({ page }) => {
    // The page streams, so the HTTP status is already 200; Next marks it noindex and renders the 404 UI.
    await page.goto("/collections/does-not-exist");
    await expect(page.getByText("This page could not be found")).toBeVisible();
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
    await expect(page).toHaveTitle(/Collection not found/);
  });

  test("document title uses the collection name", async ({ page }) => {
    await page.goto("/collections/linen-suits");
    await expect(page).toHaveTitle(/Linen Suits/);
  });

  test("bad query values do not break the page", async ({ page }) => {
    await page.goto(
      "/collections/cotton-sarees?sort=bogus&page=abc&minPrice=-5&availability=maybe",
    );
    await expect(cards(page)).toHaveCount(24);
  });

  test("home tiles and 'View all' links now reach real collection pages", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("region", { name: "Shop By Category" })
      .getByRole("link", { name: "Mulmul Sarees" })
      .click();
    await expect(page).toHaveURL(/\/collections\/mulmul-sarees$/);
    await expect(page.getByRole("heading", { level: 1, name: "Mulmul Sarees" })).toBeVisible();
  });
});

test.describe("accessibility and layout", () => {
  test("collection page has no serious a11y violations and no horizontal scroll", async ({
    page,
  }) => {
    await page.goto("/collections/cotton-sarees?availability=in-stock");
    await expect(cards(page).first()).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serious = results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    );
    expect(serious, JSON.stringify(serious.map((v) => v.id))).toEqual([]);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });

  test("mobile: filters are behind a toggle", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile only");
    await page.goto("/collections/cotton-sarees");
    const toggle = page.getByRole("button", { name: /Filter and sort/ });
    await expect(page.getByRole("button", { name: "Apply" })).toBeHidden();
    await toggle.click();
    await expect(page.getByRole("button", { name: "Apply" })).toBeVisible();
  });

  test("desktop: filters are always visible", async ({ page, isMobile }) => {
    test.skip(isMobile, "desktop only");
    await page.goto("/collections/cotton-sarees");
    await expect(page.getByRole("button", { name: "Apply" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Filter and sort/ })).toBeHidden();
  });
});

test.describe("search", () => {
  test("empty search page shows a search box", async ({ page }) => {
    await page.goto("/search");
    await expect(page.getByRole("heading", { level: 1, name: "Search" })).toBeVisible();
    await expect(page.getByRole("searchbox")).toBeVisible();
  });

  test("results page lists matches with count, filters and noindex", async ({ page }) => {
    await page.goto("/search?q=maheshwari");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("maheshwari");
    await expect(page.getByRole("status").filter({ hasText: "results" })).toHaveText("19 results");
    const titles = await cards(page).getByRole("heading").allTextContents();
    for (const t of titles) expect(t.toLowerCase()).toContain("maheshwari");
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
  });

  test("filters on search keep the query", async ({ page }) => {
    await page.goto("/search?q=saree");
    await openFilters(page);
    await page.getByLabel(/^In stock/).check();
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page).toHaveURL(/q=saree/);
    await expect(page).toHaveURL(/availability=in-stock/);
  });

  test("no results shows a helpful message", async ({ page }) => {
    await page.goto("/search?q=zzzzqqq");
    await expect(page.getByText(/No results for/)).toBeVisible();
  });

  test("header search: suggestions appear, link to a product, and Enter goes to results", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Search" }).click();
    const box = page.getByRole("searchbox");
    await box.fill("mulmul");
    const suggestions = page.getByRole("list", { name: "Search suggestions" });
    await expect(suggestions.getByRole("link").first()).toBeVisible();
    await expect(suggestions.getByRole("link")).toHaveCount(6);
    await expect(suggestions.getByRole("link").first()).toHaveAttribute("href", /^\/products\/.+/);
    await box.press("Enter");
    await expect(page).toHaveURL(/\/search\?q=mulmul/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("mulmul");
  });

  test("header search closes with Escape", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByRole("searchbox")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("searchbox")).toBeHidden();
  });

  test("search results page has no serious a11y violations", async ({ page }) => {
    await page.goto("/search?q=cotton");
    await expect(cards(page).first()).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serious = results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    );
    expect(serious, JSON.stringify(serious.map((v) => v.id))).toEqual([]);
  });
});

test.describe("JSON API", () => {
  test("filters work through /api/products", async ({ request }) => {
    const res = await request.get(
      "/api/products?collection=cotton-sarees&availability=in-stock&maxPrice=1100&sort=price-asc&pageSize=60",
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.total).toBeGreaterThan(0);
    for (const i of body.items) {
      expect(i.inStock).toBe(true);
      expect(i.pricePaise).toBeLessThanOrEqual(110000);
    }
  });
  test("invalid filter values are rejected with 400", async ({ request }) => {
    expect((await request.get("/api/products?availability=maybe")).status()).toBe(400);
    expect((await request.get("/api/products?minPrice=abc")).status()).toBe(400);
  });
});
