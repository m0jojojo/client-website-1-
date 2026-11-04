import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { createHmac } from "node:crypto";
import { createTestUser, deleteTestUsers, type TestUser } from "../helpers/test-user";
import { cleanupCartCookies } from "./helpers/cart-cleanup";
import {
  cleanupOrders,
  newEventId,
  newTestEmail,
  orderCountFor,
  sql,
  trackEmail,
} from "./helpers/order-cleanup";

const hasDb = !!process.env.DATABASE_URL && !!process.env.BETTER_AUTH_SECRET;
test.skip(!hasDb, "needs DATABASE_URL and BETTER_AUTH_SECRET");
test.describe.configure({ timeout: 90_000 });

const WEBHOOK_SECRET = "e2e-webhook-secret";
const SYNC = { timeout: 30_000 };
const userIds: string[] = [];
const guestCookies: { name: string; value: string }[] = [];

test.afterEach(async ({ context }) => {
  guestCookies.push(...(await context.cookies()));
  await cleanupCartCookies(guestCookies.splice(0));
  await cleanupOrders();
  await deleteTestUsers(userIds.splice(0));
});

async function newUser(): Promise<TestUser> {
  const u = await createTestUser();
  userIds.push(u.userId);
  trackEmail(u.email);
  return u;
}

type Prod = { handle: string; title: string; variantId: string; pricePaise: number };
async function product(
  request: APIRequestContext,
  query = "&availability=in-stock&collection=cotton-sarees",
  offset = 0,
): Promise<Prod> {
  const list = (
    await (await request.get(`/api/products?pageSize=1&page=${offset + 1}${query}`)).json()
  ).items[0];
  const d = await (await request.get(`/api/products/${list.handle}`)).json();
  return {
    handle: list.handle,
    title: list.title,
    variantId: d.variants[0].id,
    pricePaise: list.pricePaise,
  };
}

const drawer = (page: Page) => page.getByRole("dialog", { name: "Shopping cart" });

async function addToCart(page: Page, handle: string, qty = 1) {
  await page.goto(`/products/${handle}`);
  for (let i = 1; i < qty; i++)
    await page.getByRole("button", { name: "Increase quantity" }).click();
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(drawer(page)).toBeVisible();
}

async function goToCheckout(page: Page) {
  await drawer(page).getByRole("link", { name: "Checkout" }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByRole("form", { name: "Checkout" })).toBeVisible(SYNC);
}

async function fillGuestForm(page: Page, email: string, over: Record<string, string> = {}) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mobile number", { exact: true }).fill("98765 43210");
  await page.getByLabel("Full name").fill(over.fullName ?? "Asha Verma");
  await page.getByLabel("Mobile number for delivery").fill("9876543210");
  await page.getByLabel("House no., building, street").fill("12 Mansarovar Colony");
  await page.getByLabel("City").fill(over.city ?? "Jaipur");
  await page.getByLabel("PIN code").fill(over.pincode ?? "302020");
  await page.getByLabel("State").selectOption("Rajasthan");
}

const rupees = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: paise % 100 ? 2 : 0 })}`;
const sign = (raw: string) => createHmac("sha256", WEBHOOK_SECRET).update(raw).digest("hex");

/** Starts an online order through the API (using the browser's cart cookie) and returns what the server answered. */
async function startOnlineOrder(context: BrowserContext, email = newTestEmail()) {
  const res = await context.request.post("/api/checkout", {
    data: {
      idempotencyKey: crypto.randomUUID(),
      paymentMethod: "RAZORPAY",
      email,
      phone: "9876543210",
      address: {
        fullName: "Asha Verma",
        phone: "9876543210",
        line1: "12 Mansarovar Colony",
        city: "Jaipur",
        state: "Rajasthan",
        pincode: "302020",
      },
    },
  });
  expect(res.status()).toBe(200);
  return (await res.json()) as {
    order: { orderNumber: number; totalPaise: number; label: string };
    token: string;
    payment: { providerOrderId: string; amountPaise: number; mode: string };
  };
}

async function postWebhook(
  request: APIRequestContext,
  body: object,
  opts: { eventId?: string; signature?: string } = {},
) {
  const raw = JSON.stringify(body);
  return request.post("/api/webhooks/razorpay", {
    data: raw,
    headers: {
      "Content-Type": "application/json",
      "X-Razorpay-Signature": opts.signature ?? sign(raw),
      "X-Razorpay-Event-Id": opts.eventId ?? newEventId(),
    },
  });
}
const captured = (providerOrderId: string, amount: number) => ({
  event: "payment.captured",
  payload: {
    payment: {
      entity: {
        id: `pay_e2e_${crypto.randomUUID().slice(0, 8)}`,
        order_id: providerOrderId,
        amount,
        status: "captured",
      },
    },
  },
});

test.describe("guest checkout", () => {
  test("cash on delivery, from the cart to the confirmation page", async ({ page, request }) => {
    const p = await product(request);
    const email = newTestEmail();
    await addToCart(page, p.handle, 2);
    await goToCheckout(page);
    await page.getByRole("radio", { name: /Cash on delivery/ }).check();
    await expect(page.getByTestId("total")).toHaveText(rupees(p.pricePaise * 2));
    await expect(page.getByTestId("discount")).toHaveCount(0);
    await fillGuestForm(page, email);
    await page.getByRole("button", { name: /Place order/ }).click();

    await expect(page).toHaveURL(/\/orders\/\d+\?token=/, SYNC);
    await expect(page.getByRole("heading", { level: 1, name: /Order BB\d+/ })).toBeVisible();
    await expect(
      page.getByRole("status").filter({ hasText: "Order placed. Thank you!" }),
    ).toBeVisible();
    await expect(page.getByTestId("order-total")).toHaveText(rupees(p.pricePaise * 2));
    await expect(page.getByRole("region", { name: "Delivery address" })).toContainText(
      "12 Mansarovar Colony",
    );
    await expect(page.getByText(email)).toBeVisible();
    await expect(page.getByRole("region", { name: "Items in this order" })).toContainText(p.title);

    // the cart is empty afterwards
    await page.goto("/cart");
    await expect(page.getByText("Your cart is empty.")).toBeVisible(SYNC);
  });

  test("paying online takes 10% off and only confirms after the payment is verified", async ({
    page,
    request,
  }) => {
    const p = await product(request);
    await addToCart(page, p.handle, 2);
    await goToCheckout(page);
    const subtotal = p.pricePaise * 2;
    const discount = Math.round(subtotal * 0.1);
    await expect(page.getByRole("radio", { name: /Pay online/ })).toBeChecked();
    await expect(page.getByTestId("discount")).toHaveText(`−${rupees(discount)}`);
    await expect(page.getByTestId("total")).toHaveText(rupees(subtotal - discount));
    await fillGuestForm(page, newTestEmail());
    await page.getByRole("button", { name: `Pay ${rupees(subtotal - discount)}` }).click();

    const dialog = page.getByRole("dialog", { name: "Test payment" });
    await expect(dialog).toBeVisible(SYNC);
    await expect(dialog).toContainText("TEST MODE");
    await dialog.getByRole("button", { name: /\(test\)$/ }).click();

    await expect(page).toHaveURL(/\/orders\/\d+\?token=/, SYNC);
    await expect(
      page.getByRole("status").filter({ hasText: "Payment received. Thank you!" }),
    ).toBeVisible(SYNC);
    await expect(page.getByTestId("order-total")).toHaveText(rupees(subtotal - discount));
    await expect(page.getByText("Prepaid discount")).toBeVisible();
    await expect(page.getByRole("button", { name: /Pay .* now/ })).toHaveCount(0);
    await page.goto("/cart");
    await expect(page.getByText("Your cart is empty.")).toBeVisible(SYNC);
  });

  test("a failed payment leaves the order waiting, and it can be paid again", async ({
    page,
    request,
  }) => {
    const p = await product(request);
    await addToCart(page, p.handle);
    await goToCheckout(page);
    await fillGuestForm(page, newTestEmail());
    await page.getByRole("button", { name: /^Pay / }).click();
    const dialog = page.getByRole("dialog", { name: "Test payment" });
    await expect(dialog).toBeVisible(SYNC);
    await dialog.getByRole("button", { name: "Simulate a failed payment" }).click();

    await expect(page).toHaveURL(/retry=1/, SYNC);
    await expect(
      page.getByRole("status").filter({ hasText: "Waiting for your payment" }),
    ).toBeVisible(SYNC);
    await expect(page.getByText(/last payment attempt didn't go through/)).toBeVisible();
    // the cart still holds the items until paid
    await expect(page.getByRole("button", { name: "Cart, 1 item" })).toBeVisible(SYNC);

    await page.getByRole("button", { name: /Pay .* now/ }).click();
    await page
      .getByRole("dialog", { name: "Test payment" })
      .getByRole("button", { name: /\(test\)$/ })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "Payment received. Thank you!" }),
    ).toBeVisible(SYNC);
    await expect(page.getByText(/last payment attempt/)).toHaveCount(0);
  });

  test("closing the payment window keeps the order waiting", async ({ page, request }) => {
    const p = await product(request);
    await addToCart(page, p.handle);
    await goToCheckout(page);
    await fillGuestForm(page, newTestEmail());
    await page.getByRole("button", { name: /^Pay / }).click();
    const dialog = page.getByRole("dialog", { name: "Test payment" });
    await expect(dialog).toBeVisible(SYNC);
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(page).toHaveURL(/\/orders\/\d+\?token=/, SYNC);
    await expect(
      page.getByRole("status").filter({ hasText: "Waiting for your payment" }),
    ).toBeVisible(SYNC);
    await expect(page.getByRole("button", { name: /Pay .* now/ })).toBeVisible();
  });

  test("an empty form shows what to fix, next to each field", async ({ page, request }) => {
    const p = await product(request);
    await addToCart(page, p.handle);
    await goToCheckout(page);
    await page.getByRole("radio", { name: /Cash on delivery/ }).check();
    await page.getByRole("button", { name: /Place order/ }).click();
    await expect(page.getByText("Enter a valid email address")).toBeVisible(SYNC);
    await expect(page.getByLabel("Email")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("alert").filter({ hasText: "highlighted fields" })).toBeVisible();
    await expect(page).toHaveURL(/\/checkout$/);
  });

  test("a bad mobile number or PIN code is rejected", async ({ page, request }) => {
    const p = await product(request);
    await addToCart(page, p.handle);
    await goToCheckout(page);
    await page.getByRole("radio", { name: /Cash on delivery/ }).check();
    await fillGuestForm(page, newTestEmail(), { pincode: "12" });
    await page.getByLabel("Mobile number for delivery").fill("123");
    await page.getByRole("button", { name: /Place order/ }).click();
    await expect(page.getByText("Enter a valid 10-digit Indian mobile number")).toBeVisible(SYNC);
    await expect(page.getByText("Enter a valid 6-digit PIN code")).toBeVisible();
    expect(await orderCountFor("nobody")).toBe(0);
  });

  test("clicking Place order twice quickly makes only one order", async ({ page, request }) => {
    const p = await product(request);
    const email = newTestEmail();
    await addToCart(page, p.handle);
    await goToCheckout(page);
    await page.getByRole("radio", { name: /Cash on delivery/ }).check();
    await fillGuestForm(page, email);
    await page.getByRole("button", { name: /Place order/ }).dblclick();
    await expect(page).toHaveURL(/\/orders\/\d+/, SYNC);
    expect(await orderCountFor(email)).toBe(1);
  });

  test("an empty cart cannot be checked out", async ({ page }) => {
    await page.goto("/checkout");
    await expect(page.getByText("Your cart is empty.")).toBeVisible(SYNC);
    await expect(page.getByRole("form", { name: "Checkout" })).toHaveCount(0);
  });

  test("a sold-out item stops checkout, and nothing is ordered", async ({
    page,
    request,
  }, testInfo) => {
    const collection =
      testInfo.project.name === "desktop" ? "modal-silk-sarees" : "double-diamond-chiffon-sarees";
    const p = await product(request, `&availability=in-stock&collection=${collection}`).catch(
      () => null,
    );
    test.skip(!p, "no in-stock item in the test collection");
    const email = newTestEmail();
    await addToCart(page, p!.handle);
    await goToCheckout(page);
    await page.getByRole("radio", { name: /Cash on delivery/ }).check();
    await fillGuestForm(page, email);
    await sql().query('UPDATE "Variant" SET "inStock" = false WHERE id = $1', [p!.variantId]);
    try {
      await page.getByRole("button", { name: /Place order/ }).click();
      const alert = page.getByRole("alert").filter({ hasText: "sold out" });
      await expect(alert).toContainText("sold out", SYNC);
      await expect(alert).toContainText(p!.title);
      await expect(page.getByRole("link", { name: "Go to cart" })).toBeVisible();
      expect(await orderCountFor(email)).toBe(0);
    } finally {
      await sql().query('UPDATE "Variant" SET "inStock" = true WHERE id = $1', [p!.variantId]);
    }
  });

  test("checkout, confirmation and payment pages have no serious accessibility problems and fit the screen", async ({
    page,
    request,
  }) => {
    const p = await product(request);
    await addToCart(page, p.handle);
    await goToCheckout(page);
    const check = async (label: string) => {
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      const serious = results.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact ?? ""),
      );
      expect(serious, `${label}: ${JSON.stringify(serious.map((v) => v.id))}`).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
        ),
      ).toBe(false);
    };
    await check("checkout");
    await page.getByRole("radio", { name: /Cash on delivery/ }).check();
    await fillGuestForm(page, newTestEmail());
    await page.getByRole("button", { name: /Place order/ }).click();
    await expect(page).toHaveURL(/\/orders\/\d+/, SYNC);
    await expect(page.getByTestId("order-total")).toBeVisible();
    await check("order page");
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
    await expect(page.locator('meta[name="referrer"]')).toHaveAttribute("content", "no-referrer");
  });

  test("the cart page and drawer both lead to checkout", async ({ page, request }) => {
    const p = await product(request);
    await addToCart(page, p.handle);
    await drawer(page).getByRole("link", { name: "View cart" }).click();
    await page
      .getByRole("complementary", { name: "Order summary" })
      .getByRole("link", { name: "Checkout" })
      .click();
    await expect(page).toHaveURL(/\/checkout$/);
  });
});

test.describe("signed-in checkout", () => {
  test("uses the saved default address, places an order, and shows it in the account", async ({
    page,
    context,
    request,
  }) => {
    const u = await newUser();
    await context.addCookies([u.cookie]);
    await sql().query(
      'INSERT INTO "Address" ("id","userId","fullName","phone","line1","city","state","pincode","isDefault","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,NOW())',
      [
        `addr_${u.userId}`,
        u.userId,
        "Saved Person",
        "9876543210",
        "7 Saved Street",
        "Udaipur",
        "Rajasthan",
        "313001",
      ],
    );
    const p = await product(request);
    await addToCart(page, p.handle);
    await goToCheckout(page);
    await expect(page.getByLabel("Email")).toHaveValue(u.email);
    await expect(page.getByRole("radio", { name: /Saved Person/ })).toBeChecked();
    await expect(page.getByLabel("Full name")).toHaveCount(0);
    await page.getByLabel("Mobile number", { exact: true }).fill("9876543210");
    await page.getByRole("radio", { name: /Cash on delivery/ }).check();
    await page.getByRole("button", { name: /Place order/ }).click();

    await expect(page).toHaveURL(/\/orders\/\d+\?token=/, SYNC);
    await expect(page.getByRole("region", { name: "Delivery address" })).toContainText(
      "7 Saved Street",
    );
    const url = page.url();
    await page.goto("/account/orders");
    const list = page.getByRole("list", { name: "Your orders" });
    await expect(list.getByRole("listitem")).toHaveCount(1, SYNC);
    await list.getByRole("link", { name: /View order/ }).click();
    await expect(page).toHaveURL(/\/orders\/\d+$/); // no token needed for the owner
    expect(url).toContain("token=");
  });

  test("a customer can type a new address and choose to save it", async ({
    page,
    context,
    request,
  }) => {
    const u = await newUser();
    await context.addCookies([u.cookie]);
    const p = await product(request);
    await addToCart(page, p.handle);
    await goToCheckout(page);
    await page.getByRole("radio", { name: /Cash on delivery/ }).check();
    await page.getByLabel("Mobile number", { exact: true }).fill("9876543210");
    await page.getByLabel("Full name").fill("Fresh Person");
    await page.getByLabel("Mobile number for delivery").fill("9876543210");
    await page.getByLabel("House no., building, street").fill("1 New Road");
    await page.getByLabel("City").fill("Jodhpur");
    await page.getByLabel("PIN code").fill("342001");
    await page.getByLabel("State").selectOption("Rajasthan");
    await page.getByLabel("Save this address to my account").check();
    await page.getByRole("button", { name: /Place order/ }).click();
    await expect(page).toHaveURL(/\/orders\/\d+/, SYNC);
    await page.goto("/account/addresses");
    await expect(page.getByRole("list", { name: "Saved addresses" })).toContainText(
      "Fresh Person",
      SYNC,
    );
  });

  test("an order placed as a guest appears in the account when the customer signs in with the same email", async ({
    page,
    context,
    browser,
    request,
  }) => {
    const u = await newUser();
    const guestCtx = await browser.newContext();
    try {
      const gp = await guestCtx.newPage();
      const p = await product(request);
      await addToCart(gp, p.handle);
      await goToCheckout(gp);
      await gp.getByRole("radio", { name: /Cash on delivery/ }).check();
      await fillGuestForm(gp, u.email);
      await gp.getByRole("button", { name: /Place order/ }).click();
      await expect(gp).toHaveURL(/\/orders\/\d+/, SYNC);
      await cleanupCartCookies(await guestCtx.cookies());
    } finally {
      await guestCtx.close();
    }
    await context.addCookies([u.cookie]);
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Your account/ })).toBeVisible(SYNC);
    await expect
      .poll(async () => {
        await page.goto("/account/orders");
        return page.getByRole("list", { name: "Your orders" }).getByRole("listitem").count();
      }, SYNC)
      .toBe(1);
  });
});

test.describe("order privacy", () => {
  test("an order page needs the private link or the owner's sign-in", async ({
    browser,
    context,
    page,
    request,
  }) => {
    const p = await product(request);
    await addToCart(page, p.handle);
    const placed = await startOnlineOrder(context);
    const n = placed.order.orderNumber;
    const stranger = await browser.newContext();
    try {
      const sp = await stranger.newPage();
      for (const url of [
        `/orders/${n}`,
        `/orders/${n}?token=wrong`,
        `/orders/${n}?token=`,
        `/orders/${n}?token=${placed.token}x`,
      ]) {
        await sp.goto(url);
        await expect(sp.getByText("This page could not be found")).toBeVisible();
      }
      await sp.goto(`/orders/${n}?token=${placed.token}`);
      await expect(
        sp.getByRole("heading", { level: 1, name: `Order ${placed.order.label}` }),
      ).toBeVisible();
    } finally {
      await stranger.close();
    }
  });

  test("another signed-in customer cannot open someone else's order", async ({
    page,
    context,
    request,
  }) => {
    const p = await product(request);
    const owner = await newUser();
    await context.addCookies([owner.cookie]);
    await addToCart(page, p.handle);
    const placed = await startOnlineOrder(context);
    const other = await newUser();
    await context.clearCookies();
    await context.addCookies([other.cookie]);
    await page.goto(`/orders/${placed.order.orderNumber}`);
    await expect(page.getByText("This page could not be found")).toBeVisible();
    await context.clearCookies();
    await context.addCookies([owner.cookie]);
    await page.goto(`/orders/${placed.order.orderNumber}`);
    await expect(page.getByRole("heading", { level: 1, name: /Order BB/ })).toBeVisible();
  });

  test("order numbers that are not numbers are simply not found", async ({ page }) => {
    for (const bad of ["abc", "0x10", "1001;drop", "-1", "99999999999999"]) {
      await page.goto(`/orders/${encodeURIComponent(bad)}`);
      await expect(page.getByText("This page could not be found")).toBeVisible();
    }
  });
});

test.describe("checkout API security", () => {
  const body = () => ({
    idempotencyKey: crypto.randomUUID(),
    paymentMethod: "COD",
    email: newTestEmail(),
    phone: "9876543210",
    address: {
      fullName: "Asha Verma",
      phone: "9876543210",
      line1: "12 Mansarovar Colony",
      city: "Jaipur",
      state: "Rajasthan",
      pincode: "302020",
    },
  });

  test("prices, totals and discounts sent by the browser are refused", async ({
    page,
    context,
    request,
  }) => {
    const p = await product(request);
    await addToCart(page, p.handle);
    for (const extra of [
      { totalPaise: 1 },
      { total: 1 },
      { discountPaise: 99999999 },
      { items: [{ price: 1 }] },
      { status: "CONFIRMED" },
      { userId: "someone" },
    ]) {
      const res = await context.request.post("/api/checkout", { data: { ...body(), ...extra } });
      expect(res.status(), JSON.stringify(extra)).toBe(400);
    }
    // the cart is untouched
    await expect(page.getByRole("button", { name: "Cart, 1 item" })).toBeVisible(SYNC);
  });

  test("bad requests are turned away", async ({ request, playwright }) => {
    expect((await request.post("/api/checkout", { data: body() })).status()).toBe(409); // no cart at all
    expect(
      (
        await request.post("/api/checkout", { data: { ...body(), idempotencyKey: "nope" } })
      ).status(),
    ).toBe(400);
    expect(
      (
        await request.post("/api/checkout", { data: { ...body(), paymentMethod: "BITCOIN" } })
      ).status(),
    ).toBe(400);
    expect(
      (
        await request.post("/api/checkout", {
          data: "x=1",
          headers: { "Content-Type": "text/plain" },
        })
      ).status(),
    ).toBe(400);
    const evil = await playwright.request.newContext({
      baseURL: "http://localhost:3000",
      extraHTTPHeaders: { Origin: "https://evil.example" },
    });
    expect((await evil.post("/api/checkout", { data: body() })).status()).toBe(403);
    expect((await evil.post("/api/checkout/verify", { data: {} })).status()).toBe(403);
    await evil.dispose();
  });

  test("payment confirmation must carry a genuine signature for this order", async ({
    page,
    context,
    request,
  }) => {
    const p = await product(request);
    await addToCart(page, p.handle);
    const placed = await startOnlineOrder(context);
    const verify = (data: object) => context.request.post("/api/checkout/verify", { data });
    const base = {
      orderNumber: placed.order.orderNumber,
      token: placed.token,
      razorpay_order_id: placed.payment.providerOrderId,
      razorpay_payment_id: "pay_forged",
    };

    expect((await verify({ ...base, razorpay_signature: "00".repeat(32) })).status()).toBe(400);
    expect((await verify({ ...base, razorpay_signature: "not-hex" })).status()).toBe(400);
    expect(
      (
        await verify({
          ...base,
          razorpay_order_id: "order_someone_else",
          razorpay_signature: "00".repeat(32),
        })
      ).status(),
    ).toBe(400);
    expect(
      (await verify({ ...base, token: "wrong", razorpay_signature: "00".repeat(32) })).status(),
    ).toBe(404);
    expect(
      (
        await verify({ ...base, orderNumber: 999999999, razorpay_signature: "00".repeat(32) })
      ).status(),
    ).toBe(404);
    expect((await verify({ ...base, extra: 1, razorpay_signature: "00" })).status()).toBe(400);

    await page.goto(`/orders/${placed.order.orderNumber}?token=${placed.token}`);
    await expect(
      page.getByRole("status").filter({ hasText: "Waiting for your payment" }),
    ).toBeVisible(SYNC);
  });

  test("the test-payment endpoint refuses strangers and unknown orders", async ({
    request,
    page,
    context,
  }) => {
    expect(
      (
        await request.post("/api/checkout/mock-payment", {
          data: { orderNumber: 1, outcome: "success" },
        })
      ).status(),
    ).toBe(404);
    const p = await product(request);
    await addToCart(page, p.handle);
    const placed = await startOnlineOrder(context);
    expect(
      (
        await request.post("/api/checkout/mock-payment", {
          data: { orderNumber: placed.order.orderNumber, outcome: "success" },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await request.post("/api/checkout/mock-payment", {
          data: { orderNumber: placed.order.orderNumber, token: "wrong", outcome: "success" },
        })
      ).status(),
    ).toBe(404);
  });
});

test.describe("Razorpay webhook", () => {
  async function pending(page: Page, context: BrowserContext, request: APIRequestContext) {
    const p = await product(request);
    await addToCart(page, p.handle);
    return startOnlineOrder(context);
  }
  const status = async (page: Page, o: { order: { orderNumber: number }; token: string }) => {
    await page.goto(`/orders/${o.order.orderNumber}?token=${o.token}`);
    return page.getByRole("status").first();
  };

  test("rejects requests that are not properly signed", async ({ request }) => {
    const ev = captured("order_x", 5000);
    expect((await postWebhook(request, ev, { signature: "" })).status()).toBe(401);
    expect((await postWebhook(request, ev, { signature: "deadbeef" })).status()).toBe(401);
    expect((await postWebhook(request, ev, { signature: sign("something else") })).status()).toBe(
      401,
    );
    expect(
      (
        await request.post("/api/webhooks/razorpay", {
          data: JSON.stringify(ev),
          headers: { "Content-Type": "application/json", "X-Razorpay-Event-Id": newEventId() },
        })
      ).status(),
    ).toBe(401);
  });

  test("a signed 'captured' notice confirms an order the customer never returned to", async ({
    page,
    context,
    request,
  }) => {
    const o = await pending(page, context, request);
    const res = await postWebhook(
      request,
      captured(o.payment.providerOrderId, o.payment.amountPaise),
    );
    expect(res.status()).toBe(200);
    expect((await res.json()).duplicate).toBe(false);
    await expect(await status(page, o)).toContainText("Payment received", SYNC);
  });

  test("the same notice delivered twice changes nothing the second time", async ({
    page,
    context,
    request,
  }) => {
    const o = await pending(page, context, request);
    const ev = captured(o.payment.providerOrderId, o.payment.amountPaise);
    const id = newEventId();
    expect((await (await postWebhook(request, ev, { eventId: id })).json()).duplicate).toBe(false);
    expect((await (await postWebhook(request, ev, { eventId: id })).json()).duplicate).toBe(true);
    await expect(await status(page, o)).toContainText("Payment received", SYNC);
  });

  test("a payment for the wrong amount is not accepted as payment", async ({
    page,
    context,
    request,
  }) => {
    const o = await pending(page, context, request);
    expect(
      (
        await postWebhook(request, captured(o.payment.providerOrderId, o.payment.amountPaise - 100))
      ).status(),
    ).toBe(200);
    await expect(await status(page, o)).toContainText("Waiting for your payment", SYNC);
  });

  test("a failure notice is shown to the customer, who can still pay", async ({
    page,
    context,
    request,
  }) => {
    const o = await pending(page, context, request);
    const ev = {
      event: "payment.failed",
      payload: {
        payment: {
          entity: {
            id: "pay_f",
            order_id: o.payment.providerOrderId,
            error_description: "Insufficient funds",
          },
        },
      },
    };
    expect((await postWebhook(request, ev)).status()).toBe(200);
    await page.goto(`/orders/${o.order.orderNumber}?token=${o.token}`);
    await expect(page.getByText(/Insufficient funds/)).toBeVisible(SYNC);
    await expect(page.getByRole("button", { name: /Pay .* now/ })).toBeVisible();
  });

  test("notices for unknown orders, odd events and bad bodies are handled quietly", async ({
    request,
  }) => {
    expect((await postWebhook(request, captured("order_unknown_zzz", 5000))).status()).toBe(200);
    expect((await postWebhook(request, { event: "refund.created", payload: {} })).status()).toBe(
      200,
    );
    const raw = "not json at all";
    const bad = await request.post("/api/webhooks/razorpay", {
      data: raw,
      headers: {
        "Content-Type": "text/plain",
        "X-Razorpay-Signature": sign(raw),
        "X-Razorpay-Event-Id": newEventId(),
      },
    });
    expect(bad.status()).toBe(400);
    const big = "x".repeat(250_000);
    const huge = await request.post("/api/webhooks/razorpay", {
      data: big,
      headers: {
        "Content-Type": "text/plain",
        "X-Razorpay-Signature": sign(big),
        "X-Razorpay-Event-Id": newEventId(),
      },
    });
    expect(huge.status()).toBe(413);
    const noId = JSON.stringify(captured("order_x", 1));
    expect(
      (
        await request.post("/api/webhooks/razorpay", {
          data: noId,
          headers: { "Content-Type": "application/json", "X-Razorpay-Signature": sign(noId) },
        })
      ).status(),
    ).toBe(400);
  });
});
