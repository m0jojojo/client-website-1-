import { getDb } from "@/lib/db";

export type HandleKind = "products" | "collections";

const TTL_MS = 60_000;
const RECHECK_MS = 10_000;

type Known = { products: Set<string>; collections: Set<string>; loadedAt: number };
let known: Known | null = null;

async function load(): Promise<Known> {
  const db = getDb();
  const [products, collections] = await Promise.all([
    db.product.findMany({ where: { published: true }, select: { handle: true } }),
    db.collection.findMany({ select: { handle: true } }),
  ]);
  return {
    products: new Set(products.map((p) => p.handle)),
    collections: new Set(collections.map((c) => c.handle)),
    loadedAt: Date.now(),
  };
}

/**
 * Cheap "does this product or collection exist?" check for the request proxy. It keeps a short-lived
 * list of names in memory so most requests need no database trip. A name that is not on the list is
 * re-checked against the database (at most every 10 seconds), so a product added a moment ago is
 * never wrongly reported as missing for long. If the database cannot be reached it says "yes", so
 * the page's own error handling takes over instead of showing a false 404.
 */
export async function handleExists(kind: HandleKind, handle: string): Promise<boolean> {
  try {
    if (known?.[kind].has(handle) && Date.now() - known.loadedAt < TTL_MS) return true;
    if (!known || Date.now() - known.loadedAt >= RECHECK_MS) known = await load();
    return known[kind].has(handle);
  } catch (err) {
    console.error("Handle check failed; letting the page render", err);
    return true;
  }
}

/** Test helper. */
export function _resetHandleCache() {
  known = null;
}
