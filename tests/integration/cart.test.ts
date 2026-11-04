import { MAX_CART_LINES, MAX_QUANTITY } from "@/lib/cart/constants";
import {
  addItem,
  deleteCarts,
  getCartView,
  pruneStaleCarts,
  removeItem,
  setItemQuantity,
} from "@/lib/cart/service";
import { generateCartToken, hashCartToken } from "@/lib/cart/token";
import { CartError } from "@/lib/cart/types";
import { getDb } from "@/lib/db";

const hasDb = !!process.env.DATABASE_URL;
const created: string[] = [];
const newCart = () => {
  const hash = hashCartToken(generateCartToken());
  created.push(hash);
  return hash;
};

async function variantFor(opts: { inStock: boolean; offset?: number }) {
  const v = await getDb().variant.findMany({
    where: { inStock: opts.inStock, compareAtPricePaise: { not: null } },
    orderBy: { id: "asc" },
    skip: opts.offset ?? 0,
    take: 1,
    include: { product: true },
  });
  return v[0];
}

describe.skipIf(!hasDb)("cart service (real database)", () => {
  afterAll(async () => {
    await deleteCarts(created);
    await getDb().$disconnect();
  });

  it("an unknown or missing token gives an empty cart", async () => {
    expect(await getCartView(undefined)).toMatchObject({
      lines: [],
      itemCount: 0,
      subtotalPaise: 0,
    });
    expect(await getCartView(newCart())).toMatchObject({ lines: [], itemCount: 0 });
  });

  it("adds an item and prices it from the database", async () => {
    const hash = newCart();
    const v = await variantFor({ inStock: true });
    await addItem(hash, v.id, 2);
    const cart = await getCartView(hash);
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0]).toMatchObject({
      variantId: v.id,
      handle: v.product.handle,
      title: v.product.title,
      quantity: 2,
      pricePaise: v.pricePaise,
      lineTotalPaise: v.pricePaise * 2,
      available: true,
      variantTitle: null,
    });
    expect(cart.itemCount).toBe(2);
    expect(cart.subtotalPaise).toBe(v.pricePaise * 2);
    expect(cart.savingsPaise).toBe((v.compareAtPricePaise! - v.pricePaise) * 2);
  });

  it("adding the same variant again increases the quantity, capped at the maximum", async () => {
    const hash = newCart();
    const v = await variantFor({ inStock: true });
    await addItem(hash, v.id, 6);
    await addItem(hash, v.id, 6);
    const cart = await getCartView(hash);
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0].quantity).toBe(MAX_QUANTITY);
  });

  it("keeps separate lines for different variants and sums the subtotal", async () => {
    const hash = newCart();
    const a = await variantFor({ inStock: true });
    const b = await variantFor({ inStock: true, offset: 5 });
    await addItem(hash, a.id, 1);
    await addItem(hash, b.id, 3);
    const cart = await getCartView(hash);
    expect(cart.lines.map((l) => l.variantId)).toEqual([a.id, b.id]);
    expect(cart.subtotalPaise).toBe(a.pricePaise + b.pricePaise * 3);
    expect(cart.itemCount).toBe(4);
  });

  it("rejects sold-out and unknown variants without creating junk lines", async () => {
    const hash = newCart();
    const out = await variantFor({ inStock: false });
    await expect(addItem(hash, out.id, 1)).rejects.toMatchObject({ code: "SOLD_OUT" });
    await expect(addItem(hash, "no-such-variant", 1)).rejects.toMatchObject({
      code: "VARIANT_NOT_FOUND",
    });
    expect((await getCartView(hash)).lines).toHaveLength(0);
  });

  it("clamps quantities to 1..max", async () => {
    const hash = newCart();
    const v = await variantFor({ inStock: true });
    await addItem(hash, v.id, 999);
    const line = (await getCartView(hash)).lines[0];
    expect(line.quantity).toBe(MAX_QUANTITY);
    await setItemQuantity(hash, line.id, 3);
    expect((await getCartView(hash)).lines[0].quantity).toBe(3);
    await setItemQuantity(hash, line.id, 500);
    expect((await getCartView(hash)).lines[0].quantity).toBe(MAX_QUANTITY);
  });

  it("quantity 0 and remove both delete the line", async () => {
    const hash = newCart();
    const a = await variantFor({ inStock: true });
    const b = await variantFor({ inStock: true, offset: 3 });
    await addItem(hash, a.id, 1);
    await addItem(hash, b.id, 1);
    let cart = await getCartView(hash);
    await setItemQuantity(hash, cart.lines[0].id, 0);
    cart = await getCartView(hash);
    expect(cart.lines).toHaveLength(1);
    await removeItem(hash, cart.lines[0].id);
    expect((await getCartView(hash)).lines).toHaveLength(0);
  });

  it("one shopper cannot read or change another shopper's cart lines", async () => {
    const mine = newCart();
    const theirs = newCart();
    const v = await variantFor({ inStock: true });
    await addItem(theirs, v.id, 1);
    const theirLine = (await getCartView(theirs)).lines[0];
    await expect(setItemQuantity(mine, theirLine.id, 5)).rejects.toBeInstanceOf(CartError);
    await expect(removeItem(mine, theirLine.id)).rejects.toMatchObject({ code: "ITEM_NOT_FOUND" });
    expect((await getCartView(theirs)).lines[0].quantity).toBe(1);
    expect((await getCartView(mine)).lines).toHaveLength(0);
  });

  it("flags lines that sold out after being added and excludes them from totals", async () => {
    const hash = newCart();
    const v = await variantFor({ inStock: true, offset: 11 });
    await addItem(hash, v.id, 2);
    await getDb().variant.update({ where: { id: v.id }, data: { inStock: false } });
    try {
      const cart = await getCartView(hash);
      expect(cart.lines[0].available).toBe(false);
      expect(cart.itemCount).toBe(0);
      expect(cart.subtotalPaise).toBe(0);
    } finally {
      await getDb().variant.update({ where: { id: v.id }, data: { inStock: true } });
    }
  });

  it("reflects price changes immediately (prices are never stored in the cart)", async () => {
    const hash = newCart();
    const v = await variantFor({ inStock: true, offset: 13 });
    await addItem(hash, v.id, 1);
    await getDb().variant.update({
      where: { id: v.id },
      data: { pricePaise: v.pricePaise + 5000 },
    });
    try {
      expect((await getCartView(hash)).subtotalPaise).toBe(v.pricePaise + 5000);
    } finally {
      await getDb().variant.update({ where: { id: v.id }, data: { pricePaise: v.pricePaise } });
    }
  });

  it("refuses to grow past the maximum number of different lines", async () => {
    const hash = newCart();
    const variants = await getDb().variant.findMany({
      where: { inStock: true },
      take: MAX_CART_LINES + 1,
      orderBy: { id: "asc" },
    });
    for (const v of variants.slice(0, MAX_CART_LINES)) await addItem(hash, v.id, 1);
    await expect(addItem(hash, variants[MAX_CART_LINES].id, 1)).rejects.toMatchObject({
      code: "CART_FULL",
    });
    // adding more of an existing line is still fine
    await addItem(hash, variants[0].id, 1);
    expect((await getCartView(hash)).lines).toHaveLength(MAX_CART_LINES);
  }, 120_000);

  it("deleting a cart removes its lines, and pruneStaleCarts only removes old carts", async () => {
    const fresh = newCart();
    const old = newCart();
    const v = await variantFor({ inStock: true });
    await addItem(fresh, v.id, 1);
    await addItem(old, v.id, 1);
    await getDb().cart.update({
      where: { tokenHash: old },
      data: { updatedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
    });
    await getDb()
      .$executeRaw`UPDATE "Cart" SET "updatedAt" = NOW() - INTERVAL '90 days' WHERE "tokenHash" = ${old}`;
    expect(await pruneStaleCarts(60)).toBeGreaterThanOrEqual(1);
    expect((await getCartView(old)).lines).toHaveLength(0);
    expect((await getCartView(fresh)).lines).toHaveLength(1);
    expect(await deleteCarts([fresh])).toBe(1);
    expect(await getDb().cartItem.count({ where: { cart: { tokenHash: fresh } } })).toBe(0);
  });
});
