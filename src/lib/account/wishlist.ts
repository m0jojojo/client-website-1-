import { getDb } from "@/lib/db";
import { AccountError } from "./errors";

export const MAX_ACCOUNT_WISHLIST = 200;

/** Saved product handles, newest first. */
export async function listWishlistHandles(userId: string): Promise<string[]> {
  const rows = await getDb().wishlistItem.findMany({
    where: { userId, product: { published: true } },
    orderBy: { createdAt: "desc" },
    select: { product: { select: { handle: true } } },
  });
  return rows.map((r) => r.product.handle);
}

export async function addWishlistItem(userId: string, handle: string): Promise<void> {
  const db = getDb();
  const product = await db.product.findFirst({
    where: { handle, published: true },
    select: { id: true },
  });
  if (!product) throw new AccountError("NOT_FOUND", "That product was not found.");
  await db.wishlistItem.upsert({
    where: { userId_productId: { userId, productId: product.id } },
    create: { userId, productId: product.id },
    update: {},
  });
}

export async function removeWishlistItem(userId: string, handle: string): Promise<void> {
  await getDb().wishlistItem.deleteMany({ where: { userId, product: { handle } } });
}

/**
 * Adds the browser's saved handles to the account (unknown or unpublished products are ignored).
 * `handles` is newest first; that order is kept for newly added items.
 */
export async function mergeWishlist(userId: string, handles: string[]): Promise<void> {
  const db = getDb();
  const unique = [...new Set(handles)].slice(0, MAX_ACCOUNT_WISHLIST);
  if (unique.length === 0) return;
  const [products, existing] = await Promise.all([
    db.product.findMany({
      where: { handle: { in: unique }, published: true },
      select: { id: true, handle: true },
    }),
    db.wishlistItem.findMany({ where: { userId }, select: { productId: true } }),
  ]);
  const have = new Set(existing.map((e) => e.productId));
  const byHandle = new Map(products.map((p) => [p.handle, p.id]));
  const room = Math.max(0, MAX_ACCOUNT_WISHLIST - existing.length);
  const now = Date.now();
  const fresh = unique
    .map((h) => byHandle.get(h))
    .filter((id): id is string => !!id && !have.has(id))
    .slice(0, room)
    .map((productId, i) => ({ userId, productId, createdAt: new Date(now - i) }));
  if (fresh.length) await db.wishlistItem.createMany({ data: fresh, skipDuplicates: true });
}
