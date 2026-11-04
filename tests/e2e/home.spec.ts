import { expect, test } from "@playwright/test";

const hasDb = !!process.env.DATABASE_URL;

test("hero slider changes slide with the next button", async ({ page }) => {
  await page.goto("/");
  const hero = page.getByRole("region", { name: "Featured collections" });
  await expect(hero.getByRole("heading", { level: 2 })).toHaveText("New Arrivals");
  await hero.getByRole("button", { name: "Next slide" }).click();
  await expect(hero.getByRole("heading", { level: 2 })).toHaveText("Maheshwari Silk Sarees");
});

test("shop by category shows 13 tiles", async ({ page }) => {
  await page.goto("/");
  const tiles = page.getByRole("region", { name: "Shop By Category" }).getByRole("link");
  await expect(tiles).toHaveCount(13);
});

test("trust strip and testimonials render", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Secured Payments")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Voices of Royalty" })).toBeVisible();
});

test.describe("with catalog data", () => {
  test.skip(!hasDb, "needs DATABASE_URL pointing at a seeded database");

  test("product carousels load with real products and prices", async ({ page }) => {
    await page.goto("/");
    for (const name of [
      "Trending Now",
      "Saree Collection",
      "Mulmul Sarees",
      "Suits Collection",
      "Shop All",
    ]) {
      const region = page.getByRole("region", { name, exact: true });
      await expect(region).toBeVisible();
      await expect(region.getByRole("article").first()).toBeVisible();
    }
    await expect(page.getByText(/₹[\d,]+/).first()).toBeVisible();
  });

  test("a product card links to its product page path", async ({ page }) => {
    await page.goto("/");
    const first = page
      .getByRole("region", { name: "Mulmul Sarees", exact: true })
      .getByRole("article")
      .first()
      .getByRole("link")
      .first();
    await expect(first).toHaveAttribute("href", /^\/products\/.+/);
  });

  test("home page has no serious accessibility violations with products loaded", async ({
    page,
  }) => {
    const { default: AxeBuilder } = await import("@axe-core/playwright");
    await page.goto("/");
    await page.getByRole("region", { name: "Shop All", exact: true }).waitFor();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serious = results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    );
    expect(serious, JSON.stringify(serious.map((v) => v.id))).toEqual([]);
  });
});
