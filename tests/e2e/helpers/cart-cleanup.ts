import { neon } from "@neondatabase/serverless";
import type { BrowserContext } from "@playwright/test";
import { hashCartToken } from "@/lib/cart/token";

type Cookie = { name: string; value: string };

/**
 * Deletes carts by their cookie values so the shared test database stays clean.
 * Uses a plain SQL query: Playwright cannot load the generated Prisma client.
 */
export async function cleanupCartCookies(cookies: Cookie[]) {
  const hashes = cookies.filter((c) => c.name === "bagru_cart").map((c) => hashCartToken(c.value));
  const url = process.env.DATABASE_URL;
  if (hashes.length === 0 || !url) return;
  await neon(url).query('DELETE FROM "Cart" WHERE "tokenHash" = ANY($1)', [hashes]);
}

export async function cleanupCarts(...contexts: Pick<BrowserContext, "cookies">[]) {
  const all: Cookie[] = [];
  for (const ctx of contexts) all.push(...(await ctx.cookies()));
  await cleanupCartCookies(all);
}
