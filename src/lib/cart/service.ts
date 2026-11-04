import { getDb } from "@/lib/db";
import { PLACEHOLDER_IMAGE } from "@/lib/catalog/queries";
import { MAX_CART_LINES, MAX_QUANTITY } from "./constants";
import { CartError, EMPTY_CART, type CartLine, type CartOwner, type CartView } from "./types";

const clampQty = (n: number) => Math.min(MAX_QUANTITY, Math.max(1, Math.floor(n)));

const cartWhere = (owner: CartOwner) =>
  "userId" in owner ? { userId: owner.userId } : { tokenHash: owner.tokenHash };

/** Builds the cart the shopper sees, always from current database prices. */
export async function getCartView(owner: CartOwner | undefined): Promise<CartView> {
  if (!owner) return EMPTY_CART;
  const cart = await getDb().cart.findUnique({
    where: cartWhere(owner),
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
export async function ensureCart(owner: CartOwner) {
  return getDb().cart.upsert({ where: cartWhere(owner), update: {}, create: cartWhere(owner) });
}

export async function addItem(owner: CartOwner, variantId: string, quantity: number) {
  const db = getDb();
  const variant = await db.variant.findUnique({
    where: { id: variantId },
    include: { product: { select: { published: true } } },
  });
  if (!variant || !variant.product.published) {
    throw new CartError("VARIANT_NOT_FOUND", "That product is no longer available.");
  }
  if (!variant.inStock) throw new CartError("SOLD_OUT", "Sorry, this item is sold out.");

  const cart = await ensureCart(owner);
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
export async function setItemQuantity(owner: CartOwner, itemId: string, quantity: number) {
  const db = getDb();
  const item = await db.cartItem.findFirst({ where: { id: itemId, cart: cartWhere(owner) } });
  if (!item) throw new CartError("ITEM_NOT_FOUND", "That item is not in your cart.");
  if (quantity <= 0) {
    await db.cartItem.delete({ where: { id: item.id } });
  } else {
    await db.cartItem.update({ where: { id: item.id }, data: { quantity: clampQty(quantity) } });
  }
  await db.cart.update({ where: { id: item.cartId }, data: { updatedAt: new Date() } });
}

export async function removeItem(owner: CartOwner, itemId: string) {
  await setItemQuantity(owner, itemId, 0);
}

/**
 * Moves a guest cart's lines into the signed-in customer's cart (quantities add up, capped),
 * then deletes the guest cart. Safe to run twice: each line leaves the guest cart as it is moved.
 */
export async function mergeGuestCartIntoUser(tokenHash: string, userId: string): Promise<void> {
  const db = getDb();
  const guest = await db.cart.findUnique({
    where: { tokenHash },
    include: { items: { orderBy: { createdAt: "asc" } } },
  });
  if (!guest) return;
  if (guest.items.length > 0) {
    const mine = await ensureCart({ userId });
    for (const item of guest.items) {
      const existing = await db.cartItem.findUnique({
        where: { cartId_variantId: { cartId: mine.id, variantId: item.variantId } },
      });
      if (!existing) {
        const lines = await db.cartItem.count({ where: { cartId: mine.id } });
        if (lines >= MAX_CART_LINES) continue; // full: drop the rest rather than fail the login
      }
      await db.cartItem.upsert({
        where: { cartId_variantId: { cartId: mine.id, variantId: item.variantId } },
        create: { cartId: mine.id, variantId: item.variantId, quantity: clampQty(item.quantity) },
        update: { quantity: { increment: item.quantity } },
      });
      await db.cartItem.updateMany({
        where: { cartId: mine.id, variantId: item.variantId, quantity: { gt: MAX_QUANTITY } },
        data: { quantity: MAX_QUANTITY },
      });
      await db.cartItem.delete({ where: { id: item.id } });
    }
    await db.cart.update({ where: { id: mine.id }, data: { updatedAt: new Date() } });
  }
  await db.cart.delete({ where: { id: guest.id } });
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
