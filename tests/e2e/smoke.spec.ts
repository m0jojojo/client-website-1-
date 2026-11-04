import { expect, test } from "@playwright/test";

test("home page loads with a single h1 and the hero", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("region", { name: "Featured collections" })).toBeVisible();
});
