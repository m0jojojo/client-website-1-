/**
 * The most specific collection for a product, used for breadcrumbs and related items.
 * "New Arrivals" is a catch-all, so it is only used when nothing else applies.
 */
export function pickPrimaryCollection<T extends { handle: string }>(collections: T[]): T | null {
  return collections.find((c) => c.handle !== "new-arrivals") ?? collections[0] ?? null;
}
