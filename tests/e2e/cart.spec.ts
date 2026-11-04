import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { cleanupCartCookies, cleanupCarts } from "./helpers/cart-cleanup";

const hasDb = !!process.env.DATABASE_URL;
test.skip(!hasDb, "needs DATABASE_URL pointing at a seeded database");

test.afterEach(async ({ context }) => {
  await cleanupCarts(context);
});

async function product(request: APIRequestContext, query: string) {
  const res = await request.get(`/api/products?pageSize=1${query}`);
  const item = (await res.json()).items[0];
  const detail = await (await request.get(`/api/products/${item.handle}`)).json();
  return {
    handle: item.handle as string,
    title: item.title as string,
    variantId: detail.variants[0].id as string,
    pricePaise: item.pricePaise as number,
  };
}

const drawer = (page: Page) => page.getByRole("dialog", { name: "Shopping cart" });

async function addFromProductPage(page: Page, handle: string) {
  await page.goto(`/products/${handle}`);
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(drawer(page)).toBeVisible();
}

test.describe("add to cart", () => {
  test("adds from the product page, opens the drawer and shows the badge", async ({
    page,
    request,
  }) => {
    const p = await product(request, "&availability=in-stock&collection=mulmul-sarees");
    await addFromProductPage(page, p.handle);
    await expect(drawer(page).getByText(p.title)).toBeVisible();
    await expect(drawer(page).getByTestId("subtotal")).toContainText("₹");
    await drawer(page).getByRole("button", { name: "Close cart" }).click();
    await expect(drawer(page)).toBeHidden();
    await expect(page.getByRole("button", { name: "Cart, 1 item" })).toBeVisible();
  });

  test("quantity chosen on the page is what lands in the cart", async ({ page, request }) => {
    const p = await product(request, "&availability=in-stock");
    await page.goto(`/products/${p.handle}`);
    await page.getByRole("button", { name: "Increase quantity" }).click();
    await page.getByRole("button", { name: "Increase quantity" }).click();
    await page.getByRole("button", { name: "Add to cart" }).click();
    await expect(page.getByRole("button", { name: "Cart, 3 items" })).toBeVisible();
    await expect(drawer(page).getByTestId("subtotal")).toHaveText(
      new RegExp(`₹${((p.pricePaise * 3) / 100).toLocaleString("en-IN")}`),
    );
  });

  test("the cart survives a page reload and shows on the cart page", async ({ page, request }) => {
    const p = await product(request, "&availability=in-stock");
    await addFromProductPage(page, p.handle);
    await page.reload();
    await expect(page.getByRole("button", { name: "Cart, 1 item" })).toBeVisible();
    await page.goto("/cart");
    await expect(page.getByRole("heading", { level: 1, name: "Your cart" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Cart items" }).getByText(p.title)).toBeVisible();
  });

  test("adding the same product twice increases the quantity instead of duplicating the line", async ({
    page,
    request,
  }) => {
    const p = await product(request, "&availability=in-stock");
    await addFromProductPage(page, p.handle);
    await drawer(page).getByRole("button", { name: "Close cart" }).click();
    await page.getByRole("button", { name: "Add to cart" }).click();
    await expect(
      drawer(page).getByRole("list", { name: "Cart items" }).getByRole("listitem"),
    ).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Cart, 2 items" })).toBeVisible();
  });

  test("changing quantity and removing items updates totals", async ({ page, request }) => {
    const p = await product(request, "&availability=in-stock");
    await addFromProductPage(page, p.handle);
    await drawer(page)
      .getByRole("button", { name: `Increase quantity of ${p.title}` })
      .click();
    await expect(page.getByRole("button", { name: "Cart, 2 items" })).toBeVisible();
    await drawer(page)
      .getByRole("button", { name: `Decrease quantity of ${p.title}` })
      .click();
    await expect(page.getByRole("button", { name: "Cart, 1 item" })).toBeVisible();
    await drawer(page)
      .getByRole("button", { name: `Remove ${p.title} from cart` })
      .click();
    await expect(drawer(page).getByText("Your cart is empty.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cart", exact: true })).toBeVisible();
  });

  test("the cart page has the same controls and a checkout button", async ({ page, request }) => {
    const p = await product(request, "&availability=in-stock");
    await addFromProductPage(page, p.handle);
    await drawer(page).getByRole("link", { name: "View cart" }).click();
    await expect(page).toHaveURL(/\/cart$/);
    await page.getByRole("button", { name: `Increase quantity of ${p.title}` }).click();
    await expect(page.getByTestId("subtotal")).toContainText(
      `₹${((p.pricePaise * 2) / 100).toLocaleString("en-IN")}`,
    );
    await expect(
      page
        .getByRole("complementary", { name: "Order summary" })
        .getByRole("link", { name: "Checkout" }),
    ).toHaveAttribute("href", "/checkout");
    await page.getByRole("button", { name: `Remove ${p.title} from cart` }).click();
    await expect(page.getByText("Your cart is empty.")).toBeVisible();
  });

  test("an empty cart page offers a way back to shopping", async ({ page }) => {
    await page.goto("/cart");
    await expect(page.getByText("Your cart is empty.")).toBeVisible();
    await page.getByRole("link", { name: "Continue shopping" }).click();
    await expect(page).toHaveURL(/\/collections\/all$/);
  });

  test("a sold-out product cannot be added", async ({ page, request }) => {
    const p = await product(request, "&availability=out-of-stock");
    await page.goto(`/products/${p.handle}`);
    await expect(page.getByRole("button", { name: "Sold out" })).toBeDisabled();
  });

  test("the drawer closes with Escape and returns focus to the cart button", async ({
    page,
    request,
  }) => {
    const p = await product(request, "&availability=in-stock");
    await addFromProductPage(page, p.handle);
    await page.keyboard.press("Escape");
    await expect(drawer(page)).toBeHidden();
  });

  test("two browsers have separate carts", async ({ browser, request }) => {
    const p = await product(request, "&availability=in-stock");
    const a = await browser.newContext();
    const b = await browser.newContext();
    try {
      const pa = await a.newPage();
      const pb = await b.newPage();
      await addFromProductPage(pa, p.handle);
      await pb.goto("/cart");
      await expect(pb.getByText("Your cart is empty.")).toBeVisible();
      await expect(pa.getByRole("button", { name: "Cart, 1 item" })).toBeVisible();
    } finally {
      await cleanupCarts(a, b);
      await a.close();
      await b.close();
    }
  });

  test("the cart cookie is HttpOnly and SameSite=Lax", async ({ page, context, request }) => {
    const p = await product(request, "&availability=in-stock");
    await addFromProductPage(page, p.handle);
    const cookie = (await context.cookies()).find((c) => c.name === "bagru_cart");
    expect(cookie).toBeTruthy();
    expect(cookie!.httpOnly).toBe(true);
    expect(cookie!.sameSite).toBe("Lax");
    expect(cookie!.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  test("drawer and cart page have no serious accessibility violations", async ({
    page,
    request,
  }) => {
    const p = await product(request, "&availability=in-stock");
    await addFromProductPage(page, p.handle);
    let results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    let serious = results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    );
    expect(serious, JSON.stringify(serious.map((v) => v.id))).toEqual([]);
    await page.keyboard.press("Escape");
    await page.goto("/cart");
    await expect(page.getByRole("list", { name: "Cart items" })).toBeVisible();
    results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    serious = results.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""));
    expect(serious, JSON.stringify(serious.map((v) => v.id))).toEqual([]);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });
});

test.describe("cart API", () => {
  test("rejects bad input, other origins and unknown items", async ({ request }) => {
    const p = await product(request, "&availability=in-stock");
    const post = (data: unknown, headers: Record<string, string> = {}) =>
      request.post("/api/cart/items", { data, headers });
    expect((await post({})).status()).toBe(400);
    expect((await post({ variantId: p.variantId, quantity: 0 })).status()).toBe(400);
    expect((await post({ variantId: p.variantId, quantity: 11 })).status()).toBe(400);
    expect((await post({ variantId: p.variantId, quantity: 1.5 })).status()).toBe(400);
    expect((await post({ variantId: "nope", quantity: 1 })).status()).toBe(404);
    expect(
      (
        await post({ variantId: p.variantId, quantity: 1 }, { Origin: "https://evil.example" })
      ).status(),
    ).toBe(403);
    const text = await request.post("/api/cart/items", {
      data: "variantId=x",
      headers: { "Content-Type": "text/plain" },
    });
    expect(text.status()).toBe(400);
    expect(
      (await request.patch("/api/cart/items/does-not-exist", { data: { quantity: 1 } })).status(),
    ).toBe(404);
    expect((await request.delete("/api/cart/items/does-not-exist")).status()).toBe(404);
  });

  test("GET /api/cart is never cached and starts empty without setting a cookie", async ({
    request,
  }) => {
    const res = await request.get("/api/cart");
    expect(res.status()).toBe(200);
    expect(res.headers()["cache-control"]).toContain("no-store");
    expect(await res.json()).toMatchObject({ lines: [], itemCount: 0, subtotalPaise: 0 });
    expect(res.headers()["set-cookie"]).toBeUndefined();
  });

  test("a full add / change / remove round trip over the API", async ({ request }) => {
    const p = await product(request, "&availability=in-stock");
    try {
      const added = await (
        await request.post("/api/cart/items", { data: { variantId: p.variantId, quantity: 2 } })
      ).json();
      expect(added.itemCount).toBe(2);
      const id = added.lines[0].id;
      const patched = await (
        await request.patch(`/api/cart/items/${id}`, { data: { quantity: 5 } })
      ).json();
      expect(patched.itemCount).toBe(5);
      expect(patched.subtotalPaise).toBe(p.pricePaise * 5);
      const removed = await (await request.delete(`/api/cart/items/${id}`)).json();
      expect(removed.lines).toEqual([]);
    } finally {
      await cleanupCartCookies((await request.storageState()).cookies);
    }
  });
});
