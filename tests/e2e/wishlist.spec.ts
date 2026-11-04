import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const hasDb = !!process.env.DATABASE_URL;
test.skip(!hasDb, "needs DATABASE_URL pointing at a seeded database");

const card = (page: import("@playwright/test").Page, n: number) =>
  page.getByRole("region", { name: "Products", exact: true }).getByRole("article").nth(n);

test("hearts on collection cards save items, show a header count and survive reloads", async ({
  page,
}) => {
  await page.goto("/collections/mulmul-sarees");
  const first = card(page, 0);
  const title = (await first.getByRole("heading").textContent())!.trim();
  await first.getByRole("button", { name: /to wishlist/ }).click();
  await expect(
    first.getByRole("button", { name: `Remove ${title} from wishlist` }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("link", { name: "Wishlist, 1 item" })).toBeVisible();
  await page.reload();
  await expect(
    card(page, 0).getByRole("button", { name: `Remove ${title} from wishlist` }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Wishlist, 1 item" })).toBeVisible();
});

test("the wishlist page lists saved products, newest first, and items can be removed", async ({
  page,
}) => {
  await page.goto("/collections/mulmul-sarees");
  const t0 = (await card(page, 0).getByRole("heading").textContent())!.trim();
  const t1 = (await card(page, 1).getByRole("heading").textContent())!.trim();
  await card(page, 0)
    .getByRole("button", { name: /to wishlist/ })
    .click();
  await card(page, 1)
    .getByRole("button", { name: /to wishlist/ })
    .click();
  await page.getByRole("link", { name: "Wishlist, 2 items" }).click();
  await expect(page).toHaveURL(/\/wishlist$/);
  await expect(page.getByRole("heading", { level: 1, name: "Your wishlist" })).toBeVisible();
  const titles = page.getByRole("article").getByRole("heading");
  await expect(titles).toHaveText([t1, t0]);
  await page.getByRole("button", { name: `Remove ${t1} from wishlist` }).click();
  await expect(titles).toHaveText([t0]);
  await expect(page.getByRole("link", { name: "Wishlist, 1 item" })).toBeVisible();
});

test("an empty wishlist invites the shopper to browse", async ({ page }) => {
  await page.goto("/wishlist");
  await expect(page.getByText("Your wishlist is empty.")).toBeVisible();
  await page.getByRole("link", { name: "Browse all products" }).click();
  await expect(page).toHaveURL(/\/collections\/all$/);
});

test("the product page has a labelled wishlist button that stays in sync with cards", async ({
  page,
  request,
}) => {
  const handle = (
    await (await request.get("/api/products?pageSize=1&collection=linen-suits")).json()
  ).items[0].handle;
  await page.goto(`/products/${handle}`);
  await page
    .getByRole("button", { name: /to wishlist/ })
    .first()
    .click();
  await expect(page.getByText("Saved to wishlist")).toBeVisible();
  await page.goto("/wishlist");
  await expect(page.getByRole("article")).toHaveCount(1);
});

test("wishlist is private to the browser: a fresh context starts empty", async ({ browser }) => {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto("/wishlist");
  await expect(p.getByText("Your wishlist is empty.")).toBeVisible();
  await ctx.close();
});

test("garbage in localStorage does not break the site", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("bagru:wishlist:v1", "{{not json"));
  await page.goto("/wishlist");
  await expect(page.getByText("Your wishlist is empty.")).toBeVisible();
});

test("wishlist page has no serious accessibility violations", async ({ page }) => {
  await page.goto("/collections/mulmul-sarees");
  await card(page, 0)
    .getByRole("button", { name: /to wishlist/ })
    .click();
  await page.goto("/wishlist");
  await expect(page.getByRole("article")).toHaveCount(1);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const serious = results.violations.filter((v) =>
    ["serious", "critical"].includes(v.impact ?? ""),
  );
  expect(serious, JSON.stringify(serious.map((v) => v.id))).toEqual([]);
});

test("API: handles filter returns only the requested products", async ({ request }) => {
  const items = (
    await (await request.get("/api/products?pageSize=3&collection=cotton-sarees")).json()
  ).items;
  const handles = items.map((i: { handle: string }) => i.handle).join(",");
  const body = await (
    await request.get(`/api/products?handles=${encodeURIComponent(handles)}&pageSize=60`)
  ).json();
  expect(body.total).toBe(3);
  expect(body.items.map((i: { handle: string }) => i.handle).sort()).toEqual(
    handles.split(",").sort(),
  );
});
