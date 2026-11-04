import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { createAddress } from "@/lib/account/addresses";
import type { SessionUser } from "@/lib/auth-session";
import { getCartView } from "@/lib/cart/service";
import type { CartOwner } from "@/lib/cart/types";
import { getDb } from "@/lib/db";
import { getPaymentsConfig, type PaymentsConfig } from "@/lib/payments/config";
import { createProviderOrder, PaymentProviderError } from "@/lib/payments/razorpay";
import { CheckoutError } from "./errors";
import { notifyOrderConfirmed } from "./notify";
import { computeTotals, orderLabel } from "./pricing";
import type { CheckoutInput, OrderView } from "./schema";

const orderInclude = { items: { orderBy: { id: "asc" } } } as const;
type OrderRow = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export function toOrderView(o: OrderRow): OrderView {
  return {
    orderNumber: o.orderNumber,
    label: orderLabel(o.orderNumber),
    status: o.status,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    email: o.email,
    phone: o.phone,
    createdAt: o.createdAt.toISOString(),
    paidAt: o.paidAt?.toISOString() ?? null,
    failureReason: o.failureReason,
    subtotalPaise: o.subtotalPaise,
    discountPaise: o.discountPaise,
    shippingPaise: o.shippingPaise,
    totalPaise: o.totalPaise,
    address: {
      fullName: o.shipName,
      phone: o.shipPhone,
      line1: o.shipLine1,
      line2: o.shipLine2,
      landmark: o.shipLandmark,
      city: o.shipCity,
      state: o.shipState,
      pincode: o.shipPincode,
    },
    items: o.items.map((i) => ({
      handle: i.handle,
      title: i.title,
      variantTitle: i.variantTitle,
      imageUrl: i.imageUrl,
      unitPricePaise: i.unitPricePaise,
      compareAtPricePaise: i.compareAtPricePaise,
      quantity: i.quantity,
      lineTotalPaise: i.lineTotalPaise,
    })),
  };
}

export type PaymentLaunch = {
  mode: "live" | "mock";
  keyId: string;
  providerOrderId: string;
  amountPaise: number;
};

export type PlacedOrder = {
  order: OrderView;
  /** Secret for guests to reopen the order page. */
  token: string;
  /** Present for online payments that still need to be paid. */
  payment: PaymentLaunch | null;
};

export function paymentLaunchFor(row: OrderRow, config: PaymentsConfig): PaymentLaunch | null {
  if (row.paymentMethod !== "RAZORPAY" || row.status !== "PENDING_PAYMENT" || !row.razorpayOrderId)
    return null;
  if (config.mode === "unconfigured") return null;
  return {
    mode: config.mode,
    keyId: config.keyId,
    providerOrderId: row.razorpayOrderId,
    amountPaise: row.totalPaise,
  };
}

const isUniqueViolation = (e: unknown) => (e as { code?: string } | null)?.code === "P2002";

/** Removes the purchased items from the customer's cart (only those variants; newer items stay). */
async function removeOrderedFromCart(owner: CartOwner | undefined, variantIds: string[]) {
  if (!owner || variantIds.length === 0) return;
  const where = "userId" in owner ? { userId: owner.userId } : { tokenHash: owner.tokenHash };
  await getDb().cartItem.deleteMany({ where: { variantId: { in: variantIds }, cart: where } });
}

/**
 * Turns the customer's cart into an order. Everything that matters (prices, discount, total,
 * availability) is recomputed here from the database: the browser only says who, where and how.
 */
export async function placeOrder(args: {
  owner: CartOwner;
  user: SessionUser | null;
  input: CheckoutInput;
  config?: PaymentsConfig;
}): Promise<PlacedOrder> {
  const { owner, user, input } = args;
  const config = args.config ?? getPaymentsConfig();
  const db = getDb();

  // Same checkout attempt again (double click, retry): return the order we already made.
  const existing = await db.order.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    include: orderInclude,
  });
  if (existing) {
    if ((existing.userId ?? null) !== (user?.id ?? null))
      throw new CheckoutError("FORBIDDEN", "That request is not valid.");
    return {
      order: toOrderView(existing),
      token: existing.publicToken,
      payment: paymentLaunchFor(existing, config),
    };
  }

  const cart = await getCartView(owner);
  if (cart.lines.length === 0) throw new CheckoutError("EMPTY_CART", "Your cart is empty.");
  const unavailable = cart.lines.filter((l) => !l.available);
  if (unavailable.length > 0) {
    throw new CheckoutError(
      "ITEMS_UNAVAILABLE",
      "Some items in your cart are sold out. Please remove them to continue.",
      unavailable.map((l) => l.title),
    );
  }

  // Shipping address: a saved one (must be this customer's) or the one typed in.
  let ship: NonNullable<CheckoutInput["address"]>;
  if (input.addressId) {
    if (!user)
      throw new CheckoutError("ADDRESS_NOT_FOUND", "Please sign in to use a saved address.");
    const saved = await db.address.findFirst({ where: { id: input.addressId, userId: user.id } });
    if (!saved) throw new CheckoutError("ADDRESS_NOT_FOUND", "That saved address was not found.");
    ship = {
      fullName: saved.fullName,
      phone: saved.phone,
      line1: saved.line1,
      line2: saved.line2 ?? undefined,
      landmark: saved.landmark ?? undefined,
      city: saved.city,
      state: saved.state as NonNullable<CheckoutInput["address"]>["state"],
      pincode: saved.pincode,
    };
  } else {
    ship = input.address!;
  }

  const totals = computeTotals(cart.subtotalPaise, input.paymentMethod);

  let providerOrderId: string | null = null;
  if (input.paymentMethod === "RAZORPAY") {
    if (config.mode === "unconfigured") {
      throw new CheckoutError(
        "PAYMENT_UNAVAILABLE",
        "Online payment isn't available right now. Please choose cash on delivery.",
      );
    }
    try {
      const po = await createProviderOrder(
        { amountPaise: totals.totalPaise, receipt: input.idempotencyKey },
        config,
      );
      providerOrderId = po.id;
    } catch (e) {
      if (e instanceof PaymentProviderError)
        throw new CheckoutError("PAYMENT_UNAVAILABLE", e.message);
      throw e;
    }
  }

  const cod = input.paymentMethod === "COD";
  const publicToken = randomBytes(24).toString("base64url");
  let row: OrderRow;
  try {
    row = await db.order.create({
      data: {
        publicToken,
        idempotencyKey: input.idempotencyKey,
        userId: user?.id,
        email: input.email,
        phone: input.phone,
        status: cod ? "CONFIRMED" : "PENDING_PAYMENT",
        paymentMethod: input.paymentMethod,
        paymentStatus: "PENDING",
        ...totals,
        shipName: ship.fullName,
        shipPhone: ship.phone,
        shipLine1: ship.line1,
        shipLine2: ship.line2 ?? null,
        shipLandmark: ship.landmark ?? null,
        shipCity: ship.city,
        shipState: ship.state,
        shipPincode: ship.pincode,
        razorpayOrderId: providerOrderId,
        items: {
          create: cart.lines.map((l) => ({
            variantId: l.variantId,
            handle: l.handle,
            title: l.title,
            variantTitle: l.variantTitle,
            imageUrl: l.imageUrl,
            unitPricePaise: l.pricePaise,
            compareAtPricePaise: l.compareAtPricePaise,
            quantity: l.quantity,
            lineTotalPaise: l.lineTotalPaise,
          })),
        },
      },
      include: orderInclude,
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      // Two identical requests raced; the other one won. Return its order.
      const winner = await db.order.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: orderInclude,
      });
      if (winner && (winner.userId ?? null) === (user?.id ?? null)) {
        return {
          order: toOrderView(winner),
          token: winner.publicToken,
          payment: paymentLaunchFor(winner, config),
        };
      }
    }
    throw e;
  }

  if (cod) {
    await removeOrderedFromCart(
      owner,
      cart.lines.map((l) => l.variantId),
    );
    notifyOrderConfirmed(toOrderView(row));
  }

  if (input.saveAddress && user && input.address) {
    // Nice to have: saving can fail (e.g. the 10-address limit) without affecting the order.
    await createAddress(user.id, { ...input.address, isDefault: false }).catch(() => {});
  }

  return {
    order: toOrderView(row),
    token: row.publicToken,
    payment: paymentLaunchFor(row, config),
  };
}

/** Safe constant-time check of the secret order token. */
export function tokenMatches(expected: string, given: string | undefined | null): boolean {
  if (!given) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Finds an order the requester is allowed to see: the signed-in owner, or anyone holding the
 * order's secret token. Anything else looks exactly like "no such order".
 */
export async function getAccessibleOrder(args: {
  orderNumber: number;
  user: SessionUser | null;
  token?: string | null;
}): Promise<{ order: OrderView; row: OrderRow } | null> {
  const row = await getDb().order.findUnique({
    where: { orderNumber: args.orderNumber },
    include: orderInclude,
  });
  if (!row) return null;
  const isOwner = !!args.user && row.userId === args.user.id;
  if (!isOwner && !tokenMatches(row.publicToken, args.token)) return null;
  return { order: toOrderView(row), row };
}

export async function listOrdersForUser(userId: string): Promise<OrderView[]> {
  const rows = await getDb().order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: orderInclude,
    take: 100,
  });
  return rows.map(toOrderView);
}

/** At sign-in, orders placed as a guest with the same (Google-verified) email join the account. */
export async function claimGuestOrders(user: { id: string; email: string }): Promise<number> {
  const res = await getDb().order.updateMany({
    where: { userId: null, email: { equals: user.email.toLowerCase(), mode: "insensitive" } },
    data: { userId: user.id },
  });
  return res.count;
}

/**
 * Records a successful payment. Safe to call many times and from many places (the browser's
 * confirmation, the webhook): only the first call changes anything. Returns true on that first call.
 */
export async function markPaid(args: {
  providerOrderId: string;
  paymentId: string;
  /** If known, must equal what we asked for; a mismatch is never marked paid. */
  amountPaise?: number;
}): Promise<{ changed: boolean; found: boolean }> {
  const db = getDb();
  const order = await db.order.findUnique({
    where: { razorpayOrderId: args.providerOrderId },
    include: orderInclude,
  });
  if (!order) return { changed: false, found: false };
  if (args.amountPaise !== undefined && args.amountPaise !== order.totalPaise) {
    console.error(
      `Payment amount mismatch for order ${order.orderNumber}: got ${args.amountPaise}, expected ${order.totalPaise}`,
    );
    return { changed: false, found: true };
  }
  const res = await db.order.updateMany({
    where: { id: order.id, paymentStatus: { not: "PAID" }, status: { not: "CANCELLED" } },
    data: {
      paymentStatus: "PAID",
      status: "CONFIRMED",
      paidAt: new Date(),
      razorpayPaymentId: args.paymentId,
      failureReason: null,
    },
  });
  if (res.count === 1) {
    const owner: CartOwner | undefined = order.userId ? { userId: order.userId } : undefined;
    await removeOrderedFromCart(
      owner,
      order.items.flatMap((i) => (i.variantId ? [i.variantId] : [])),
    );
    const fresh = await db.order.findUniqueOrThrow({
      where: { id: order.id },
      include: orderInclude,
    });
    notifyOrderConfirmed(toOrderView(fresh));
  }
  return { changed: res.count === 1, found: true };
}

/** Remembers why the latest attempt failed. The customer can still pay the same order later. */
export async function recordPaymentFailure(providerOrderId: string, reason: string) {
  await getDb().order.updateMany({
    where: { razorpayOrderId: providerOrderId, paymentStatus: { not: "PAID" } },
    data: { failureReason: reason.slice(0, 200) },
  });
}

/** Removes a guest's purchased items from their cart after payment (called with their cart owner). */
export async function clearOrderedItems(owner: CartOwner | undefined, orderNumber: number) {
  const items = await getDb().orderItem.findMany({
    where: { order: { orderNumber } },
    select: { variantId: true },
  });
  await removeOrderedFromCart(
    owner,
    items.flatMap((i) => (i.variantId ? [i.variantId] : [])),
  );
}

export async function logPaymentEvent(args: {
  provider: string;
  eventId: string;
  type: string;
  orderId?: string | null;
  payload: Prisma.InputJsonValue;
}): Promise<boolean> {
  try {
    await getDb().paymentEvent.create({
      data: {
        provider: args.provider,
        eventId: args.eventId,
        type: args.type,
        orderId: args.orderId ?? null,
        payload: args.payload,
      },
    });
    return true;
  } catch (e) {
    if (isUniqueViolation(e)) return false; // already processed
    throw e;
  }
}
