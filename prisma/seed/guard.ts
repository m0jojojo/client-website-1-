export type SeedTargetState = {
  orders: number;
  wishlistItems: number;
  cartItems: number;
  users: number;
};

/**
 * The seed deletes and reloads the catalog tables. That is harmless on an empty or development
 * database, but on a live one it would also wipe customers' wishlists and cart lines (they point at
 * products). Refuse when the database already holds customer data, unless FORCE_SEED=true.
 */
export function assertSafeToSeed(state: SeedTargetState, force = false): void {
  if (force) return;
  const found = [
    state.orders && `${state.orders} order(s)`,
    state.wishlistItems && `${state.wishlistItems} saved wishlist item(s)`,
    state.cartItems && `${state.cartItems} cart line(s)`,
    state.users && `${state.users} account(s)`,
  ].filter(Boolean);
  if (found.length === 0) return;
  throw new Error(
    `Refusing to seed: this database already holds customer data (${found.join(", ")}). ` +
      `Reloading the catalog would delete saved wishlists and cart lines. ` +
      `If this is a development database and that is fine, run again with FORCE_SEED=true.`,
  );
}
