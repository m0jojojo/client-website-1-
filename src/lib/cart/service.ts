import { getDb } from "@/lib/db";
import { PLACEHOLDER_IMAGE } from "@/lib/catalog/queries";
import { MAX_CART_LINES, MAX_QUANTITY } from "./constants";
import { CartError, EMPTY_CART, type CartLine, type CartView } from "./types";

const clampQty = (n: number) => Math.min(MAX_QUANTITY, Math.max(1, Math.floor(n)));

/** Builds the cart the shopper sees, always from current database prices. */
export async function getCartView(tokenHash: string | undefined): Promise<CartView> {
  if (!tokenHash) return EMPTY_CART;
  const cart = await getDb().cart.findUnique({
    where: { tokenHash },
    include: {
      items: {
        orderBy: { createdAt: "asc" },
        include: {
          variant: {
            include: {
              product: { include: { images: { orderBy: { position: "asc" }, take: 1 } } },
            },
          },
        },
      },
    },
  });
  if (!cart) return EMPTY_CART;

  const lines: CartLine[] = cart.items.map((i) => {
    const v = i.variant;
    const img = v.product.images[0];
    return {
      id: i.id,
      variantId: v.id,
      handle: v.product.handle,
      title: v.product.title,
      variantTitle: v.title === "Default Title" ? null : v.title,
      pricePaise: v.pricePaise,
      compareAtPricePaise: v.compareAtPricePaise,
      quantity: i.quantity,
      lineTotalPaise: v.pricePaise * i.quantity,
      available: v.inStock && v.product.published,
      imageUrl: img?.url ?? PLACEHOLDER_IMAGE,
      imageAlt: img?.alt || v.product.title,
    };
  });

  const live = lines.filter((l) => l.available);
  return {
    lines,
    itemCount: live.reduce((n, l) => n + l.quantity, 0),
    subtotalPaise: live.reduce((n, l) => n + l.lineTotalPaise, 0),
    savingsPaise: live.reduce(
      (n, l) =>
        n +
        (l.compareAtPricePaise && l.compareAtPricePaise > l.pricePaise
          ? (l.compareAtPricePaise - l.pricePaise) * l.quantity
          : 0),
      0,
    ),
  };
}

/** Finds or creates the cart for this token hash. */
export async function ensureCart(tokenHash: string) {
  return getDb().cart.upsert({ where: { tokenHash }, update: {}, create: { tokenHash } });
}

export async function addItem(tokenHash: string, variantId: string, quantity: number) {
  const db = getDb();
  const variant = await db.variant.findUnique({
    where: { id: variantId },
    include: { product: { select: { published: true } } },
  });
  if (!variant || !variant.product.published) {
    throw new CartError("VARIANT_NOT_FOUND", "That product is no longer available.");
  }
  if (!variant.inStock) throw new CartError("SOLD_OUT", "Sorry, this item is sold out.");

  const cart = await ensureCart(tokenHash);
  const existing = await db.cartItem.findUnique({
    where: { cartId_variantId: { cartId: cart.id, variantId } },
  });
  if (!existing) {
    const lines = await db.cartItem.count({ where: { cartId: cart.id } });
    if (lines >= MAX_CART_LINES) {
      throw new CartError("CART_FULL", `Your cart is full (${MAX_CART_LINES} different items).`);
    }
  }

  const qty = clampQty(quantity);
  await db.cartItem.upsert({
    where: { cartId_variantId: { cartId: cart.id, variantId } },
    create: { cartId: cart.id, variantId, quantity: qty },
    update: { quantity: { increment: qty } },
  });
  // Several adds can race past the limit; pull the line back to the maximum.
  await db.cartItem.updateMany({
    where: { cartId: cart.id, variantId, quantity: { gt: MAX_QUANTITY } },
    data: { quantity: MAX_QUANTITY },
  });
  await db.cart.update({ where: { id: cart.id }, data: { updatedAt: new Date() } });
}

/** Sets a line's quantity; 0 removes it. The line must belong to this cart. */
export async function setItemQuantity(tokenHash: string, itemId: string, quantity: number) {
  const db = getDb();
  const item = await db.cartItem.findFirst({ where: { id: itemId, cart: { tokenHash } } });
  if (!item) throw new CartError("ITEM_NOT_FOUND", "That item is not in your cart.");
  if (quantity <= 0) {
    await db.cartItem.delete({ where: { id: item.id } });
  } else {
    await db.cartItem.update({ where: { id: item.id }, data: { quantity: clampQty(quantity) } });
  }
  await db.cart.update({ where: { id: item.cartId }, data: { updatedAt: new Date() } });
}

export async function removeItem(tokenHash: string, itemId: string) {
  await setItemQuantity(tokenHash, itemId, 0);
}

/** Test and housekeeping helper: delete carts by token hash. */
export async function deleteCarts(tokenHashes: string[]) {
  if (tokenHashes.length === 0) return 0;
  const res = await getDb().cart.deleteMany({ where: { tokenHash: { in: tokenHashes } } });
  return res.count;
}

/** Housekeeping: remove carts nobody has touched for a while. */
export async function pruneStaleCarts(olderThanDays = 60) {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const res = await getDb().cart.deleteMany({ where: { updatedAt: { lt: cutoff } } });
  return res.count;
}
