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

test.describe("scrolling announcement bar", () => {
  const strip = (page: import("@playwright/test").Page) =>
    page.getByRole("region", { name: "Store announcements" });
  const track = (page: import("@playwright/test").Page) => strip(page).locator(".promo-track");
  const style = (
    page: import("@playwright/test").Page,
    prop: "animationName" | "animationPlayState",
  ) => track(page).evaluate((el, p) => getComputedStyle(el)[p as "animationName"], prop);

  test("scrolls continuously and actually moves", async ({ page }) => {
    await page.goto("/");
    await expect(track(page)).toBeVisible();
    expect(await style(page, "animationName")).toBe("promo-scroll");
    expect(await style(page, "animationPlayState")).toBe("running");
    const x1 = await track(page).evaluate((el) => el.getBoundingClientRect().x);
    await page.waitForTimeout(1500);
    const x2 = await track(page).evaluate((el) => el.getBoundingClientRect().x);
    expect(x2).toBeLessThan(x1);
  });

  test("pauses on hover, and resumes when the mouse leaves", async ({ page, isMobile }) => {
    test.skip(isMobile, "hover needs a mouse");
    await page.goto("/");
    await strip(page).hover();
    await expect.poll(() => style(page, "animationPlayState")).toBe("paused");
    await page.mouse.move(600, 400);
    await expect.poll(() => style(page, "animationPlayState")).toBe("running");
  });

  test("the pause button stops and restarts the scrolling", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Pause announcements" }).click();
    await page.mouse.move(600, 500); // move away so only the button state matters
    await expect.poll(() => style(page, "animationPlayState")).toBe("paused");
    const x1 = await track(page).evaluate((el) => el.getBoundingClientRect().x);
    await page.waitForTimeout(1000);
    expect(await track(page).evaluate((el) => el.getBoundingClientRect().x)).toBe(x1);
    await page.getByRole("button", { name: "Play announcements" }).click();
    await page.mouse.move(600, 500);
    await expect.poll(() => style(page, "animationPlayState")).toBe("running");
  });

  test("the pause button works from the keyboard and playing resumes straight away", async ({
    page,
  }) => {
    await page.goto("/");
    const button = page.getByRole("button", { name: "Pause announcements" });
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Play announcements" })).toBeFocused();
    await expect.poll(() => style(page, "animationPlayState")).toBe("paused");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Pause announcements" })).toBeFocused();
    await expect.poll(() => style(page, "animationPlayState")).toBe("running");
  });

  test("shows still, centred text with no pause button for visitors who prefer reduced motion", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    expect(await style(page, "animationName")).toBe("none");
    await expect(page.getByRole("button", { name: /announcements/ })).toBeHidden();
    const box = await strip(page).boundingBox();
    const viewport = page.viewportSize()!;
    expect(box!.width).toBeLessThanOrEqual(viewport.width);
    // every message is fully on screen: nothing cut off at either edge
    const items = strip(page).getByRole("listitem");
    await expect(items).toHaveCount(4);
    for (let i = 0; i < 4; i++) {
      const b = (await items.nth(i).boundingBox())!;
      expect(b.x, `message ${i + 1} left edge`).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width, `message ${i + 1} right edge`).toBeLessThanOrEqual(viewport.width);
    }
  });

  test("the bar never makes the page scroll sideways and stays one line tall", async ({ page }) => {
    await page.goto("/");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
    ).toBe(false);
    const h = (await strip(page).boundingBox())!.height;
    expect(h).toBeLessThan(48);
  });

  test("screen readers get each message once", async ({ page }) => {
    await page.goto("/");
    const items = strip(page).getByRole("listitem");
    await expect(items).toHaveCount(4);
  });
});
