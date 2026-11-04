import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { cleanupCartCookies } from "./helpers/cart-cleanup";

const hasDb = !!process.env.DATABASE_URL;
test.skip(!hasDb, "needs DATABASE_URL pointing at a seeded database");

async function firstHandle(request: import("@playwright/test").APIRequestContext, query = "") {
  const res = await request.get(`/api/products?pageSize=1${query}`);
  return (await res.json()).items[0].handle as string;
}

test.describe("product page", () => {
  test("opens from a product card and shows the key details", async ({ page }) => {
    await page.goto("/collections/mulmul-sarees");
    const card = page
      .getByRole("region", { name: "Products", exact: true })
      .getByRole("article")
      .first();
    const title = (await card.getByRole("heading").textContent())!.trim();
    await card.getByRole("link").first().click();
    await expect(page).toHaveURL(/\/products\/.+/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await expect(page.getByTestId("price")).toContainText("₹");
    await expect(page.getByText("Taxes included.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add to cart" })).toBeEnabled();
    await expect(page).toHaveTitle(new RegExp(title.slice(0, 15).replace(/[^\w ]/g, ".")));
  });

  test("shows discount, breadcrumbs, trust badges and description", async ({ page, request }) => {
    const handle = await firstHandle(request, "&collection=mulmul-sarees");
    await page.goto(`/products/${handle}`);
    await expect(page.getByText(/% OFF/).first()).toBeVisible();
    const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(crumbs.getByRole("link", { name: "Home" })).toBeVisible();
    await expect(crumbs.getByRole("link", { name: "Mulmul Sarees" })).toHaveAttribute(
      "href",
      "/collections/mulmul-sarees",
    );
    await expect(page.getByRole("list", { name: "Our promises" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Description" })).toBeVisible();
  });

  test("breadcrumb collection link works", async ({ page, request }) => {
    const handle = await firstHandle(request, "&collection=linen-suits");
    await page.goto(`/products/${handle}`);
    await page
      .getByRole("navigation", { name: "Breadcrumb" })
      .getByRole("link", { name: "Linen Suits" })
      .click();
    await expect(page).toHaveURL(/\/collections\/linen-suits$/);
  });

  test("quantity stepper is clamped between 1 and 10", async ({ page, request }) => {
    await page.goto(`/products/${await firstHandle(request, "&availability=in-stock")}`);
    const qty = page.getByRole("spinbutton", { name: "Quantity" });
    await expect(qty).toHaveValue("1");
    await expect(page.getByRole("button", { name: "Decrease quantity" })).toBeDisabled();
    await page.getByRole("button", { name: "Increase quantity" }).click();
    await expect(qty).toHaveValue("2");
    await qty.fill("50");
    await expect(qty).toHaveValue("10");
    await expect(page.getByRole("button", { name: "Increase quantity" })).toBeDisabled();
  });

  test("a sold-out product has a disabled Sold out button", async ({ page, request }) => {
    await page.goto(`/products/${await firstHandle(request, "&availability=out-of-stock")}`);
    await expect(page.getByRole("button", { name: "Sold out" })).toBeDisabled();
  });

  test("enlarge opens a dialog and Escape closes it", async ({ page, request }) => {
    await page.goto(`/products/${await firstHandle(request)}`);
    await page.getByRole("button", { name: "Open image in larger view" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("related products carousel lists other products and links to them", async ({
    page,
    request,
  }) => {
    const handle = await firstHandle(request, "&collection=mulmul-sarees");
    await page.goto(`/products/${handle}`);
    const related = page.getByRole("region", { name: "You may also like", exact: true });
    await expect(related).toBeVisible();
    const links = related.getByRole("article").getByRole("link");
    expect(await links.count()).toBeGreaterThan(3);
    const hrefs = await links.evaluateAll((els) => els.map((e) => e.getAttribute("href")));
    expect(hrefs).not.toContain(`/products/${handle}`);
    await links.first().click();
    await expect(page).toHaveURL(/\/products\/.+/);
    await expect(page).not.toHaveURL(new RegExp(`${handle}$`));
  });

  test("embeds valid Product structured data", async ({ page, request }) => {
    await page.goto(`/products/${await firstHandle(request)}`);
    const raw = await page.locator('script[type="application/ld+json"]').first().textContent();
    const ld = JSON.parse(raw!);
    expect(ld["@type"]).toBe("Product");
    expect(ld.offers.priceCurrency).toBe("INR");
    expect(Number(ld.offers.price)).toBeGreaterThan(0);
  });

  test("an unknown product shows the not-found page", async ({ page }) => {
    await page.goto("/products/does-not-exist");
    await expect(page.getByText("This page could not be found")).toBeVisible();
    await expect(page).toHaveTitle(/not found|could not be found/i);
  });

  test("has no serious accessibility violations and no horizontal scroll", async ({
    page,
    request,
  }) => {
    await page.goto(`/products/${await firstHandle(request, "&collection=cotton-sarees")}`);
    await expect(
      page.getByRole("region", { name: "You may also like", exact: true }),
    ).toBeVisible();
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

  test("search suggestions link to a working product page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Search" }).click();
    await page.getByRole("searchbox").fill("mulmul");
    const first = page.getByRole("list", { name: "Search suggestions" }).getByRole("link").first();
    await first.click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/mulmul/i);
  });
});

test.describe("pinned Add to cart bar", () => {
  const bar = (page: import("@playwright/test").Page) => page.getByTestId("add-to-cart-bar");
  const addButton = (page: import("@playwright/test").Page) =>
    page.getByRole("button", { name: "Add to cart" });

  async function open(
    page: import("@playwright/test").Page,
    request: import("@playwright/test").APIRequestContext,
  ) {
    const handle = await firstHandle(request, "&availability=in-stock&collection=cotton-sarees");
    await page.goto(`/products/${handle}`);
    await expect(addButton(page)).toBeVisible();
    return handle;
  }

  test("stays in its normal place while it is on screen", async ({ page, request }) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await open(page, request);
    await expect(bar(page)).not.toHaveClass(/fixed/);
    await expect(page.locator("body")).not.toHaveAttribute("data-sticky-cta", "true");
  });

  test("sticks to the bottom of the screen once scrolled past, and goes back when scrolled up", async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 1280, height: 700 });
    await open(page, request);
    await page.evaluate(() => window.scrollTo(0, 1100));
    await expect(bar(page)).toHaveClass(/fixed/);
    await expect(page.locator("body")).toHaveAttribute("data-sticky-cta", "true");
    const vh = page.viewportSize()!.height;
    const box = (await addButton(page).boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(vh);
    expect(box.y).toBeGreaterThan(vh - 120); // hugging the bottom edge
    await expect(addButton(page)).toBeInViewport({ ratio: 1 });

    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(bar(page)).not.toHaveClass(/fixed/);
    await expect(page.locator("body")).not.toHaveAttribute("data-sticky-cta", "true");
  });

  test("there is only ever one Add to cart button, even while pinned", async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 1280, height: 700 });
    await open(page, request);
    await page.evaluate(() => window.scrollTo(0, 1100));
    await expect(bar(page)).toHaveClass(/fixed/);
    await expect(addButton(page)).toHaveCount(1);
  });

  test("on a phone it is pinned straight away when the button starts below the fold", async ({
    page,
    request,
    isMobile,
  }) => {
    test.skip(!isMobile, "phone only");
    await open(page, request);
    const buttonTopWhenStatic = await page.evaluate(
      () =>
        document
          .querySelector("[data-testid=add-to-cart-bar]")!
          .parentElement!.getBoundingClientRect().top,
    );
    const vh = page.viewportSize()!.height;
    if (buttonTopWhenStatic > vh - 60) {
      await expect(bar(page)).toHaveClass(/fixed/);
    }
    await expect(addButton(page)).toBeInViewport({ ratio: 1 });
  });

  test("works from the pinned bar: adds the chosen quantity to the cart", async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 1280, height: 700 });
    await open(page, request);
    await page.getByRole("button", { name: "Increase quantity" }).click();
    await page.evaluate(() => window.scrollTo(0, 1100));
    await expect(bar(page)).toHaveClass(/fixed/);
    await addButton(page).click();
    await expect(page.getByRole("dialog", { name: "Shopping cart" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cart, 2 items" })).toBeVisible();
    await cleanupCartCookies(await page.context().cookies());
  });

  test("shows the price next to the button while pinned", async ({ page, request }) => {
    await page.setViewportSize({ width: 1280, height: 700 });
    await open(page, request);
    await page.evaluate(() => window.scrollTo(0, 1100));
    await expect(bar(page)).toHaveClass(/fixed/);
    await expect(bar(page)).toContainText("₹");
  });

  test("the WhatsApp button moves up so it never sits on the bar", async ({ page, request }) => {
    await page.setViewportSize({ width: 1280, height: 700 });
    await open(page, request);
    const wa = page.getByRole("link", { name: /whatsapp/i });
    const lowBefore = (await wa.boundingBox())!;
    await page.evaluate(() => window.scrollTo(0, 1100));
    await expect(bar(page)).toHaveClass(/fixed/);
    await expect.poll(async () => (await wa.boundingBox())!.y).toBeLessThan(lowBefore.y);
    const w = (await wa.boundingBox())!;
    const b = (await bar(page).boundingBox())!;
    expect(w.y + w.height).toBeLessThanOrEqual(b.y + 1);
  });

  test("the end of the page is not hidden behind the bar", async ({ page, request }) => {
    await page.setViewportSize({ width: 1280, height: 700 });
    await open(page, request);
    await page.evaluate(() => window.scrollTo(0, 1100));
    await expect(bar(page)).toHaveClass(/fixed/);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const copyright = page.getByText(/All rights reserved/);
    await expect(copyright).toBeVisible();
    const c = (await copyright.boundingBox())!;
    const b = (await bar(page).boundingBox())!;
    expect(c.y + c.height).toBeLessThanOrEqual(b.y + 1);
  });

  test("sold-out products still show a disabled bar button", async ({ page, request }) => {
    await page.setViewportSize({ width: 1280, height: 700 });
    await page.goto(`/products/${await firstHandle(request, "&availability=out-of-stock")}`);
    await page.evaluate(() => window.scrollTo(0, 1100));
    const sold = page.getByRole("button", { name: "Sold out" });
    await expect(sold).toBeDisabled();
    await expect(sold).toBeInViewport();
  });

  test("no sideways scrolling and no serious accessibility problems while pinned", async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 1280, height: 700 });
    await open(page, request);
    await page.evaluate(() => window.scrollTo(0, 1100));
    await expect(bar(page)).toHaveClass(/fixed/);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
    ).toBe(false);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serious = results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    );
    expect(serious, JSON.stringify(serious.map((v) => v.id))).toEqual([]);
  });
});
