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

test.describe("category carousel", () => {
  const carousel = (page: import("@playwright/test").Page) =>
    page.getByRole("region", { name: "Categories", exact: true });
  const track = (page: import("@playwright/test").Page) => carousel(page).getByRole("list");

  test("the pictures are perfect circles", async ({ page }) => {
    await page.goto("/");
    const circles = carousel(page).locator("a > span:first-child");
    await expect(circles).toHaveCount(13);
    const first = circles.first();
    await first.scrollIntoViewIfNeeded();
    const { w, h, radius } = await first.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return {
        w: Math.round(r.width),
        h: Math.round(r.height),
        radius: getComputedStyle(el).borderTopLeftRadius,
      };
    });
    expect(w).toBeGreaterThan(60);
    expect(Math.abs(w - h)).toBeLessThanOrEqual(1);
    expect(parseFloat(radius)).toBeGreaterThanOrEqual(w / 2 - 1);
  });

  test("more tiles exist than fit on screen, so it can be slid sideways", async ({ page }) => {
    await page.goto("/");
    const { scrollWidth, clientWidth } = await track(page).evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(scrollWidth).toBeGreaterThan(clientWidth + 100);
    // a tile is cut off by the right edge, which hints that the row slides
    const peeking = await carousel(page)
      .getByRole("link")
      .evaluateAll((els) => {
        const edge = els[0].closest("ul")!.getBoundingClientRect().right;
        return els.some((e) => {
          const r = e.getBoundingClientRect();
          return r.left < edge - 20 && r.right > edge + 20;
        });
      });
    expect(peeking).toBe(true);
  });

  test("the arrow buttons slide the tiles on a computer", async ({ page, isMobile }) => {
    test.skip(isMobile, "arrow buttons are for larger screens; phones swipe");
    await page.goto("/");
    const before = await track(page).evaluate((el) => el.scrollLeft);
    await page.getByRole("button", { name: "Next Categories" }).click();
    await expect
      .poll(() => track(page).evaluate((el) => el.scrollLeft))
      .toBeGreaterThan(before + 100);
    const mid = await track(page).evaluate((el) => el.scrollLeft);
    await page.getByRole("button", { name: "Previous Categories" }).click();
    await expect.poll(() => track(page).evaluate((el) => el.scrollLeft)).toBeLessThan(mid);
  });

  test("sliding to the end reveals the last category, and it can be opened", async ({ page }) => {
    await page.goto("/");
    await track(page).evaluate((el) => el.scrollTo({ left: el.scrollWidth, behavior: "instant" }));
    const last = carousel(page).getByRole("link", { name: "Linen Dupatta Cotton Suit" });
    await expect(last).toBeInViewport();
    await last.click();
    await expect(page).toHaveURL(/\/collections\/linen-dupatta-cotton-suit$/);
  });

  test("page does not scroll sideways because of the carousel", async ({ page }) => {
    await page.goto("/");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
    ).toBe(false);
  });

  test("tiles can be reached with the keyboard", async ({ page }) => {
    await page.goto("/");
    const firstTile = carousel(page).getByRole("link").first();
    await firstTile.focus();
    await expect(firstTile).toBeFocused();
    for (let i = 0; i < 9; i++) await page.keyboard.press("Tab");
    // tabbing moves on through tiles and the carousel scrolls to keep the focused one in view
    const focused = page.locator(":focus");
    await expect(focused).toBeInViewport();
  });
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
