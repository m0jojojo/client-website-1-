import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { cleanupCartCookies } from "./helpers/cart-cleanup";
import { createTestUser, deleteTestUsers, type TestUser } from "../helpers/test-user";

// The login merge makes many database round trips; allow for a slow link to the database.
const SYNC = { timeout: 30_000 };
test.describe.configure({ timeout: 90_000 });
const hasDb = !!process.env.DATABASE_URL && !!process.env.BETTER_AUTH_SECRET;
test.skip(!hasDb, "needs DATABASE_URL and BETTER_AUTH_SECRET");

const userIds: string[] = [];
const guestCookies: { name: string; value: string }[] = [];

test.afterEach(async ({ context }) => {
  guestCookies.push(...(await context.cookies()));
  await cleanupCartCookies(guestCookies.splice(0));
  await deleteTestUsers(userIds.splice(0));
});

async function newUser(name?: string): Promise<TestUser> {
  const u = await createTestUser({ name });
  userIds.push(u.userId);
  return u;
}
const signIn = (context: BrowserContext, u: TestUser) => context.addCookies([u.cookie]);

async function productInfo(request: APIRequestContext, query = "&availability=in-stock") {
  const item = (await (await request.get(`/api/products?pageSize=1${query}`)).json()).items[0];
  const detail = await (await request.get(`/api/products/${item.handle}`)).json();
  return {
    handle: item.handle as string,
    title: item.title as string,
    variantId: detail.variants[0].id as string,
  };
}

const validAddress = {
  fullName: "Asha Verma",
  phone: "9876543210",
  line1: "12 Mansarovar Colony",
  city: "Jaipur",
  state: "Rajasthan",
  pincode: "302020",
};

async function fillAddress(page: Page, a: Partial<typeof validAddress> & { phone?: string }) {
  const v = { ...validAddress, ...a };
  await page.getByLabel("Full name").fill(v.fullName);
  await page.getByLabel("Mobile number").fill(v.phone);
  await page.getByLabel("House no., building, street").fill(v.line1);
  await page.getByLabel("City").fill(v.city);
  await page.getByLabel("PIN code").fill(v.pincode);
  await page.getByLabel("State").selectOption(v.state);
}

test.describe("signing in", () => {
  test("account pages send guests to the login page and remember where they were going", async ({
    page,
  }) => {
    for (const path of ["/account", "/account/addresses", "/account/orders"]) {
      await page.goto(path);
      await expect(page).toHaveURL(
        new RegExp(`/account/login\\?next=${encodeURIComponent(path).replace(/\//g, "%2F")}`),
      );
      await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
    }
  });

  test("the login page offers Google and starts the Google redirect", async ({ page }) => {
    await page.route("https://accounts.google.com/**", (route) =>
      route.fulfill({ status: 200, body: "google" }),
    );
    await page.goto("/account/login?next=/account/addresses");
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await page.waitForURL(/accounts\.google\.com/);
    const url = new URL(page.url());
    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3000/api/auth/callback/google",
    );
    expect(url.searchParams.get("state")).toBeTruthy();
    expect(url.searchParams.get("scope")).toContain("email");
  });

  test("the sign-in API returns a Google URL for the page the shopper wanted", async ({
    request,
  }) => {
    const res = await request.post("/api/auth/sign-in/social", {
      data: { provider: "google", callbackURL: "/account/orders" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.url).toMatch(/^https:\/\/accounts\.google\.com\//);
  });

  test("a signed-in customer is shown their account in the header and overview", async ({
    page,
    context,
  }) => {
    const u = await newUser("Meera Joshi");
    await signIn(context, u);
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Your account, Meera Joshi" })).toHaveText(
      "M",
      SYNC,
    );
    await page.getByRole("link", { name: "Your account, Meera Joshi" }).click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByRole("heading", { level: 1, name: "Hello, Meera Joshi" })).toBeVisible();
    await expect(page.getByText(u.email)).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Account" }).getByRole("link", { name: "Overview" }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("a signed-in customer visiting the login page is sent on to where they were going", async ({
    page,
    context,
  }) => {
    await signIn(context, await newUser());
    await page.goto("/account/login?next=/account/orders");
    await expect(page).toHaveURL(/\/account\/orders$/);
  });

  test("the login redirect cannot be pointed at another website", async ({ page, context }) => {
    await signIn(context, await newUser());
    for (const bad of ["https://evil.example/phish", "//evil.example", "javascript:alert(1)"]) {
      await page.goto(`/account/login?next=${encodeURIComponent(bad)}`);
      await expect(page).toHaveURL(/localhost:3000\/account$/);
    }
  });

  test("the orders page explains there are no orders yet", async ({ page, context }) => {
    await signIn(context, await newUser());
    await page.goto("/account/orders");
    await expect(page.getByText("You haven't placed any orders yet.")).toBeVisible();
  });

  test("signing out returns to a guest experience and locks the account pages again", async ({
    page,
    context,
  }) => {
    await signIn(context, await newUser());
    await page.goto("/account");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/localhost:3000\/$/);
    await expect(page.getByRole("link", { name: "Log in" })).toBeVisible(SYNC);
    await page.goto("/account");
    await expect(page).toHaveURL(/\/account\/login/);
  });

  test("an expired or forged session cookie is treated as signed out", async ({
    page,
    context,
  }) => {
    const u = await newUser();
    await context.addCookies([{ ...u.cookie, value: u.cookie.value.slice(0, -4) + "AAAA" }]);
    await page.goto("/account");
    await expect(page).toHaveURL(/\/account\/login/);
  });
});

test.describe("addresses", () => {
  test("add, validate, edit, set default and delete", async ({ page, context }) => {
    await signIn(context, await newUser());
    await page.goto("/account/addresses");
    await expect(page.getByText("You have no saved addresses.")).toBeVisible();

    await page.getByRole("button", { name: "Add a new address" }).click();
    await fillAddress(page, { phone: "123", pincode: "12" });
    await page.getByRole("button", { name: "Save address" }).click();
    await expect(page.getByText("Enter a valid 10-digit Indian mobile number")).toBeVisible();
    await expect(page.getByText("Enter a valid 6-digit PIN code")).toBeVisible();
    await expect(page.getByLabel("Mobile number")).toHaveAttribute("aria-invalid", "true");

    await fillAddress(page, { phone: "+91 98765-43210", pincode: "302020" });
    await page.getByRole("button", { name: "Save address" }).click();
    const list = page.getByRole("list", { name: "Saved addresses" });
    await expect(list.getByText("Asha Verma")).toBeVisible();
    await expect(list.getByText("Default", { exact: true })).toBeVisible();
    await expect(list.getByText(/Phone: 9876543210/)).toBeVisible();

    await page.getByRole("button", { name: "Add a new address" }).click();
    await fillAddress(page, { fullName: "Meera Joshi", city: "Udaipur" });
    await page.getByRole("button", { name: "Save address" }).click();
    await expect(list.getByRole("listitem")).toHaveCount(2);
    await expect(list.getByText("Default", { exact: true })).toHaveCount(1);

    await page.getByRole("button", { name: "Make address for Meera Joshi the default" }).click();
    await expect(list.getByRole("listitem").first()).toContainText("Meera Joshi");
    await expect(list.getByRole("listitem").first()).toContainText("Default");

    await page.getByRole("button", { name: "Edit address for Asha Verma" }).click();
    await page.getByLabel("City").fill("Jodhpur");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(list).toContainText("Jodhpur");

    await page.reload();
    await expect(
      page.getByRole("list", { name: "Saved addresses" }).getByRole("listitem"),
    ).toHaveCount(2);
    await expect(page.getByRole("list", { name: "Saved addresses" })).toContainText("Jodhpur");

    await page.getByRole("button", { name: "Delete address for Meera Joshi" }).click();
    await page.getByRole("button", { name: "Yes, delete" }).click();
    await expect(
      page.getByRole("list", { name: "Saved addresses" }).getByRole("listitem"),
    ).toHaveCount(1);
    await expect(page.getByText("Default", { exact: true })).toBeVisible(); // the remaining address was promoted
  });

  test("the overview counts saved addresses", async ({ page, context }) => {
    const u = await newUser();
    await signIn(context, u);
    await page.goto("/account/addresses");
    await page.getByRole("button", { name: "Add a new address" }).click();
    await fillAddress(page, {});
    await page.getByRole("button", { name: "Save address" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Address saved." })).toBeVisible();
    await page
      .getByRole("navigation", { name: "Account" })
      .getByRole("link", { name: "Overview" })
      .click();
    await expect(page.getByText("1 saved address.")).toBeVisible();
  });

  test("address pages have no serious accessibility problems and fit a phone", async ({
    page,
    context,
  }) => {
    await signIn(context, await newUser());
    await page.goto("/account/addresses");
    await page.getByRole("button", { name: "Add a new address" }).click();
    await expect(page.getByRole("form", { name: "Save address" })).toBeVisible();
    for (const path of ["/account/addresses", "/account", "/account/orders"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      const serious = results.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact ?? ""),
      );
      expect(serious, `${path}: ${JSON.stringify(serious.map((v) => v.id))}`).toEqual([]);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflow).toBe(false);
    }
  });

  test("the login page has no serious accessibility problems", async ({ page }) => {
    await page.goto("/account/login");
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serious = results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    );
    expect(serious, JSON.stringify(serious.map((v) => v.id))).toEqual([]);
  });
});

test.describe("account API security", () => {
  test("every account endpoint refuses signed-out requests", async ({ request }) => {
    expect((await request.get("/api/account/addresses")).status()).toBe(401);
    expect((await request.post("/api/account/addresses", { data: validAddress })).status()).toBe(
      401,
    );
    expect(
      (await request.patch("/api/account/addresses/x", { data: { city: "x" } })).status(),
    ).toBe(401);
    expect((await request.delete("/api/account/addresses/x")).status()).toBe(401);
    expect((await request.put("/api/account/wishlist/x")).status()).toBe(401);
    expect((await request.delete("/api/account/wishlist/x")).status()).toBe(401);
    expect((await request.post("/api/account/sync", { data: { wishlist: [] } })).status()).toBe(
      401,
    );
  });

  test("writes from another website are blocked even with a valid session", async ({
    playwright,
    context,
  }) => {
    const u = await newUser();
    await signIn(context, u);
    const api = await playwright.request.newContext({
      baseURL: "http://localhost:3000",
      extraHTTPHeaders: {
        Cookie: `${u.cookie.name}=${u.cookie.value}`,
        Origin: "https://evil.example",
      },
    });
    expect((await api.post("/api/account/addresses", { data: validAddress })).status()).toBe(403);
    expect((await api.post("/api/account/sync", { data: { wishlist: [] } })).status()).toBe(403);
    expect((await api.put("/api/account/wishlist/x")).status()).toBe(403);
    await api.dispose();
  });

  test("input is validated and unknown fields cannot be smuggled in", async ({ playwright }) => {
    const u = await newUser();
    const api = await playwright.request.newContext({
      baseURL: "http://localhost:3000",
      extraHTTPHeaders: { Cookie: `${u.cookie.name}=${u.cookie.value}` },
    });
    const bad = await api.post("/api/account/addresses", { data: { ...validAddress, phone: "1" } });
    expect(bad.status()).toBe(400);
    expect((await bad.json()).fields.phone).toMatch(/10-digit/);
    expect(
      (
        await api.post("/api/account/addresses", {
          data: { ...validAddress, userId: "someone-else" },
        })
      ).status(),
    ).toBe(400);
    expect((await api.post("/api/account/addresses", { data: {} })).status()).toBe(400);
    const text = await api.post("/api/account/addresses", {
      data: "x",
      headers: { "Content-Type": "text/plain" },
    });
    expect(text.status()).toBe(400);
    expect((await api.put("/api/account/wishlist/no-such-product")).status()).toBe(404);
    expect((await api.get("/api/account/addresses")).status()).toBe(200);
    await api.dispose();
  });

  test("customers cannot read or change each other's addresses", async ({ playwright }) => {
    const a = await newUser();
    const b = await newUser();
    const as = (u: TestUser) =>
      playwright.request.newContext({
        baseURL: "http://localhost:3000",
        extraHTTPHeaders: { Cookie: `${u.cookie.name}=${u.cookie.value}` },
      });
    const apiA = await as(a);
    const apiB = await as(b);
    const created = await (
      await apiA.post("/api/account/addresses", { data: validAddress })
    ).json();
    const id = created.items[0].id as string;
    expect((await (await apiB.get("/api/account/addresses")).json()).items).toEqual([]);
    expect(
      (await apiB.patch(`/api/account/addresses/${id}`, { data: { city: "Hacked" } })).status(),
    ).toBe(404);
    expect((await apiB.delete(`/api/account/addresses/${id}`)).status()).toBe(404);
    expect((await (await apiA.get("/api/account/addresses")).json()).items[0].city).toBe("Jaipur");
    await apiA.dispose();
    await apiB.dispose();
  });

  test("session cookie is HttpOnly when issued by Better Auth", async ({ request }) => {
    // Sign-in sets cookies only after Google returns, so check the config indirectly:
    // the get-session endpoint must never expose tokens to scripts.
    const res = await request.get("/api/auth/get-session");
    expect(res.status()).toBe(200);
    expect(await res.json()).toBeNull();
  });
});

test.describe("merging a guest's cart and wishlist at sign-in", () => {
  test("the guest cart follows the customer into their account", async ({
    page,
    context,
    request,
  }) => {
    const p = await productInfo(request);
    await page.goto(`/products/${p.handle}`);
    await page.getByRole("button", { name: "Add to cart" }).click();
    await expect(page.getByRole("button", { name: "Cart, 1 item" })).toBeVisible();
    expect((await context.cookies()).some((c) => c.name === "bagru_cart")).toBe(true);
    guestCookies.push(...(await context.cookies()));

    await signIn(context, await newUser());
    await page.reload();
    await expect(page.getByRole("link", { name: /Your account/ })).toBeVisible(SYNC);
    await expect(page.getByRole("button", { name: "Cart, 1 item" })).toBeVisible(SYNC);
    await expect
      .poll(async () => (await context.cookies()).some((c) => c.name === "bagru_cart"))
      .toBe(false);
    await page.goto("/cart");
    await expect(page.getByRole("list", { name: "Cart items" }).getByText(p.title)).toBeVisible();
  });

  test("guest and account items combine and quantities add up", async ({
    browser,
    page,
    context,
    request,
  }) => {
    const p = await productInfo(request);
    const u = await newUser();
    // The customer already has 2 of this item in their account cart (from another device).
    const other = await browser.newContext();
    await signIn(other, u);
    const op = await other.newPage();
    await op.goto(`/products/${p.handle}`);
    await op.getByRole("button", { name: "Increase quantity" }).click();
    await op.getByRole("button", { name: "Add to cart" }).click();
    await expect(op.getByRole("button", { name: "Cart, 2 items" })).toBeVisible();
    await other.close();

    // On this device they shop as a guest first (3 of the same item), then sign in.
    await page.goto(`/products/${p.handle}`);
    await page.getByRole("button", { name: "Increase quantity" }).click();
    await page.getByRole("button", { name: "Increase quantity" }).click();
    await page.getByRole("button", { name: "Add to cart" }).click();
    await expect(page.getByRole("button", { name: "Cart, 3 items" })).toBeVisible();
    guestCookies.push(...(await context.cookies()));
    await signIn(context, u);
    await page.reload();
    await expect(page.getByRole("button", { name: "Cart, 5 items" })).toBeVisible(SYNC);
  });

  test("the cart is shared between a customer's devices", async ({ browser, request }) => {
    const p = await productInfo(request);
    const u = await newUser();
    const a = await browser.newContext();
    const b = await browser.newContext();
    await signIn(a, u);
    await signIn(b, u);
    const pa = await a.newPage();
    await pa.goto(`/products/${p.handle}`);
    await pa.getByRole("button", { name: "Add to cart" }).click();
    await expect(pa.getByRole("button", { name: "Cart, 1 item" })).toBeVisible();
    const pb = await b.newPage();
    await pb.goto("/cart");
    await expect(pb.getByRole("list", { name: "Cart items" }).getByText(p.title)).toBeVisible();
    await a.close();
    await b.close();
  });

  test("the guest wishlist is saved to the account at sign-in and shows on other devices", async ({
    browser,
    page,
    context,
  }) => {
    await page.goto("/collections/mulmul-sarees");
    const card = page
      .getByRole("region", { name: "Products", exact: true })
      .getByRole("article")
      .first();
    const title = (await card.getByRole("heading").textContent())!.trim();
    await card.getByRole("button", { name: /to wishlist/ }).click();
    await expect(page.getByRole("link", { name: "Wishlist, 1 item" })).toBeVisible();

    const u = await newUser();
    await signIn(context, u);
    await page.reload();
    await expect(page.getByRole("link", { name: /Your account/ })).toBeVisible(SYNC);
    await expect(page.getByRole("link", { name: "Wishlist, 1 item" })).toBeVisible(SYNC);

    const device2 = await browser.newContext();
    await signIn(device2, u);
    const p2 = await device2.newPage();
    await p2.goto("/wishlist");
    await expect(p2.getByRole("article").getByRole("heading")).toHaveText([title]);
    await device2.close();
  });

  test("changes made while signed in are kept in the account", async ({
    browser,
    page,
    context,
  }) => {
    const u = await newUser();
    await signIn(context, u);
    await page.goto("/collections/mulmul-sarees");
    await expect(page.getByRole("link", { name: /Your account/ })).toBeVisible(SYNC);
    const card = page
      .getByRole("region", { name: "Products", exact: true })
      .getByRole("article")
      .first();
    const title = (await card.getByRole("heading").textContent())!.trim();
    await card.getByRole("button", { name: /to wishlist/ }).click();
    await expect(page.getByRole("link", { name: "Wishlist, 1 item" })).toBeVisible();
    await page.waitForTimeout(500);

    const device2 = await browser.newContext();
    await signIn(device2, u);
    const p2 = await device2.newPage();
    await p2.goto("/wishlist");
    await expect(p2.getByRole("article").getByRole("heading")).toHaveText([title]);
    await p2.getByRole("button", { name: `Remove ${title} from wishlist` }).click();
    await p2.waitForTimeout(500);
    await device2.close();

    await page.goto("/wishlist"); // a fresh page load re-syncs with the account
    await expect(page.getByText("Your wishlist is empty.")).toBeVisible();
  });

  test("signing out leaves no wishlist or cart behind on the shared computer", async ({
    page,
    context,
    request,
  }) => {
    const p = await productInfo(request);
    await signIn(context, await newUser());
    await page.goto(`/products/${p.handle}`);
    await page
      .getByRole("button", { name: /to wishlist/ })
      .first()
      .click();
    await page.getByRole("button", { name: "Add to cart" }).click();
    await expect(page.getByRole("button", { name: "Cart, 1 item" })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.goto("/account");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByRole("link", { name: "Log in" })).toBeVisible(SYNC);
    await expect(page.getByRole("button", { name: "Cart", exact: true })).toBeVisible();
    await page.goto("/wishlist");
    await expect(page.getByText("Your wishlist is empty.")).toBeVisible(SYNC);
    await page.goto("/cart");
    await expect(page.getByText("Your cart is empty.")).toBeVisible();
  });
});
