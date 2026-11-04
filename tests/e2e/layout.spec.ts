import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("layout shell shows promo, header, footer and WhatsApp button", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Store announcements" })).toBeVisible();
  await expect(page.getByRole("link", { name: "The Block Bagru" }).first()).toBeVisible();
  await expect(page.getByRole("contentinfo")).toContainText("GSTIN");
  await expect(page.getByRole("link", { name: /whatsapp/i })).toBeVisible();
});

test("desktop: Sarees dropdown lists categories", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop only");
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main" });
  await nav.getByRole("button", { name: /Sarees/ }).click();
  await expect(nav.getByRole("link", { name: "Chanderi Silk Sarees" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(nav.getByRole("link", { name: "Chanderi Silk Sarees" })).toBeHidden();
});

test("mobile: hamburger opens the menu", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile only");
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("navigation", { name: "Mobile" })).toBeVisible();
});

test("no horizontal scroll", async ({ page }) => {
  await page.goto("/");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});

test("no serious accessibility violations on home", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const serious = results.violations.filter((v) =>
    ["serious", "critical"].includes(v.impact ?? ""),
  );
  expect(serious, JSON.stringify(serious.map((v) => v.id))).toEqual([]);
});
