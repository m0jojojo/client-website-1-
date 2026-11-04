import { randomUUID } from "node:crypto";
import { createAddress, listAddresses } from "@/lib/account/addresses";
import { addItem, deleteCarts, getCartView } from "@/lib/cart/service";
import { generateCartToken, hashCartToken } from "@/lib/cart/token";
import type { CartOwner } from "@/lib/cart/types";
import { getDb } from "@/lib/db";
import { CheckoutError } from "@/lib/orders/errors";
import { PREPAID_DISCOUNT_PERCENT } from "@/lib/orders/pricing";
import type { CheckoutInput } from "@/lib/orders/schema";
import {
  claimGuestOrders,
  getAccessibleOrder,
  listOrdersForUser,
  logPaymentEvent,
  markPaid,
  placeOrder,
  recordPaymentFailure,
} from "@/lib/orders/service";
import { MOCK_KEY_ID, MOCK_KEY_SECRET, type PaymentsConfig } from "@/lib/payments/config";
import { createTestUser, deleteTestUsers } from "../helpers/test-user";

const hasDb = !!process.env.DATABASE_URL && !!process.env.BETTER_AUTH_SECRET;
const mock: PaymentsConfig = { mode: "mock", keyId: MOCK_KEY_ID, keySecret: MOCK_KEY_SECRET };
const off: PaymentsConfig = { mode: "unconfigured" };

const userIds: string[] = [];
const guestHashes: string[] = [];
const restore: (() => Promise<unknown>)[] = [];

const guest = (): CartOwner => {
  const tokenHash = hashCartToken(generateCartToken());
  guestHashes.push(tokenHash);
  return { tokenHash };
};
const newUser = async () => {
  const u = await createTestUser();
  userIds.push(u.userId);
  return u;
};
const asUser = (u: { userId: string; name: string; email: string }) => ({
  id: u.userId,
  name: u.name,
  email: u.email,
});

const address = {
  fullName: "Asha Verma",
  phone: "9876543210",
  line1: "12 Mansarovar Colony",
  city: "Jaipur",
  state: "Rajasthan" as const,
  pincode: "302020",
};
const input = (over: Partial<CheckoutInput> = {}): CheckoutInput => ({
  idempotencyKey: randomUUID(),
  paymentMethod: "COD",
  email: `${randomUUID().slice(0, 8)}@e2e.test`,
  phone: "9876543210",
  address,
  ...over,
});

const stocked = (n: number, skip = 0) =>
  getDb().variant.findMany({
    where: { inStock: true },
    orderBy: { id: "asc" },
    skip,
    take: n,
    include: { product: true },
  });

async function cartWith(owner: CartOwner, items: { variantId: string; qty: number }[]) {
  for (const i of items) await addItem(owner, i.variantId, i.qty);
}

describe.skipIf(!hasDb)("orders (real database)", () => {
  afterAll(async () => {
    for (const fn of restore.reverse()) await fn();
    await getDb().paymentEvent.deleteMany({ where: { eventId: { startsWith: "it-evt-" } } });
    await getDb().order.deleteMany({
      where: { email: { endsWith: "@e2e.test", mode: "insensitive" } },
    });
    await deleteCarts(guestHashes);
    await deleteTestUsers(userIds);
    await getDb().$disconnect();
  });

  describe("placing an order", () => {
    it("cash on delivery: confirms straight away at full price, copies the cart, empties it", async () => {
      const owner = guest();
      const [a, b] = await stocked(2);
      await cartWith(owner, [
        { variantId: a.id, qty: 2 },
        { variantId: b.id, qty: 1 },
      ]);
      const subtotal = a.pricePaise * 2 + b.pricePaise;

      const placed = await placeOrder({ owner, user: null, input: input(), config: mock });
      const o = placed.order;
      expect(o.orderNumber).toBeGreaterThanOrEqual(1001);
      expect(o.label).toBe(`BB${o.orderNumber}`);
      expect(o).toMatchObject({
        status: "CONFIRMED",
        paymentMethod: "COD",
        paymentStatus: "PENDING",
        subtotalPaise: subtotal,
        discountPaise: 0,
        shippingPaise: 0,
        totalPaise: subtotal,
      });
      expect(placed.payment).toBeNull();
      expect(placed.token.length).toBeGreaterThanOrEqual(30);
      expect(o.items).toHaveLength(2);
      expect(o.items[0]).toMatchObject({
        title: a.product.title,
        quantity: 2,
        unitPricePaise: a.pricePaise,
        lineTotalPaise: a.pricePaise * 2,
      });
      expect(o.address).toMatchObject({
        fullName: "Asha Verma",
        city: "Jaipur",
        pincode: "302020",
      });
      expect((await getCartView(owner)).lines).toEqual([]);
    });

    it("online payment: waits for payment, takes 10% off, and leaves the cart alone until paid", async () => {
      const owner = guest();
      const [a] = await stocked(1, 3);
      await cartWith(owner, [{ variantId: a.id, qty: 3 }]);
      const subtotal = a.pricePaise * 3;
      const discount = Math.round((subtotal * PREPAID_DISCOUNT_PERCENT) / 100);

      const placed = await placeOrder({
        owner,
        user: null,
        input: input({ paymentMethod: "RAZORPAY" }),
        config: mock,
      });
      expect(placed.order).toMatchObject({
        status: "PENDING_PAYMENT",
        paymentMethod: "RAZORPAY",
        paymentStatus: "PENDING",
        subtotalPaise: subtotal,
        discountPaise: discount,
        totalPaise: subtotal - discount,
      });
      expect(placed.payment).toMatchObject({
        mode: "mock",
        keyId: MOCK_KEY_ID,
        amountPaise: subtotal - discount,
      });
      expect(placed.payment?.providerOrderId).toMatch(/^order_mock_/);
      expect((await getCartView(owner)).itemCount).toBe(3);
    });

    it("an order number is never reused and counts up", async () => {
      const nums: number[] = [];
      for (let i = 0; i < 3; i++) {
        const owner = guest();
        const [v] = await stocked(1, 10 + i);
        await cartWith(owner, [{ variantId: v.id, qty: 1 }]);
        nums.push(
          (await placeOrder({ owner, user: null, input: input(), config: mock })).order.orderNumber,
        );
      }
      expect(new Set(nums).size).toBe(3);
      expect(nums).toEqual([...nums].sort((x, y) => x - y));
    });

    it("the same checkout attempt twice returns the same order (no double orders)", async () => {
      const owner = guest();
      const [v] = await stocked(1, 20);
      await cartWith(owner, [{ variantId: v.id, qty: 1 }]);
      const body = input({ paymentMethod: "RAZORPAY" });
      const a = await placeOrder({ owner, user: null, input: body, config: mock });
      const b = await placeOrder({ owner, user: null, input: body, config: mock });
      expect(b.order.orderNumber).toBe(a.order.orderNumber);
      expect(b.token).toBe(a.token);
      expect(b.payment?.providerOrderId).toBe(a.payment?.providerOrderId);
      expect(await getDb().order.count({ where: { idempotencyKey: body.idempotencyKey } })).toBe(1);
    });

    it("two simultaneous identical requests still make one order", async () => {
      const owner = guest();
      const [v] = await stocked(1, 21);
      await cartWith(owner, [{ variantId: v.id, qty: 1 }]);
      const body = input();
      const [a, b] = await Promise.all([
        placeOrder({ owner, user: null, input: body, config: mock }),
        placeOrder({ owner, user: null, input: body, config: mock }),
      ]);
      expect(a.order.orderNumber).toBe(b.order.orderNumber);
      expect(await getDb().order.count({ where: { idempotencyKey: body.idempotencyKey } })).toBe(1);
    });

    it("a checkout key cannot be used to read another customer's order", async () => {
      const owner = guest();
      const [v] = await stocked(1, 22);
      await cartWith(owner, [{ variantId: v.id, qty: 1 }]);
      const body = input();
      await placeOrder({ owner, user: null, input: body, config: mock });
      const intruder = await newUser();
      await expect(
        placeOrder({
          owner: { userId: intruder.userId },
          user: asUser(intruder),
          input: body,
          config: mock,
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("refuses an empty cart", async () => {
      await expect(
        placeOrder({ owner: guest(), user: null, input: input(), config: mock }),
      ).rejects.toMatchObject({ code: "EMPTY_CART" });
    });

    it("refuses sold-out items and names them", async () => {
      const owner = guest();
      const [v] = await stocked(1, 23);
      await cartWith(owner, [{ variantId: v.id, qty: 1 }]);
      await getDb().variant.update({ where: { id: v.id }, data: { inStock: false } });
      restore.push(() => getDb().variant.update({ where: { id: v.id }, data: { inStock: true } }));
      const err = await placeOrder({ owner, user: null, input: input(), config: mock }).catch(
        (e) => e,
      );
      expect(err).toBeInstanceOf(CheckoutError);
      expect(err.code).toBe("ITEMS_UNAVAILABLE");
      expect(err.details).toEqual([v.product.title]);
      await getDb().variant.update({ where: { id: v.id }, data: { inStock: true } });
    });

    it("online payment is refused when it is not configured, but COD still works", async () => {
      const owner = guest();
      const [v] = await stocked(1, 24);
      await cartWith(owner, [{ variantId: v.id, qty: 1 }]);
      await expect(
        placeOrder({ owner, user: null, input: input({ paymentMethod: "RAZORPAY" }), config: off }),
      ).rejects.toMatchObject({ code: "PAYMENT_UNAVAILABLE" });
      expect((await getCartView(owner)).itemCount).toBe(1); // nothing lost
      const ok = await placeOrder({ owner, user: null, input: input(), config: off });
      expect(ok.order.status).toBe("CONFIRMED");
    });

    it("prices come from the database now, and an order keeps its prices when the catalog changes later", async () => {
      const owner = guest();
      const [v] = await stocked(1, 25);
      await cartWith(owner, [{ variantId: v.id, qty: 1 }]);
      await getDb().variant.update({
        where: { id: v.id },
        data: { pricePaise: v.pricePaise + 10000 },
      });
      restore.push(() =>
        getDb().variant.update({ where: { id: v.id }, data: { pricePaise: v.pricePaise } }),
      );
      const placed = await placeOrder({ owner, user: null, input: input(), config: mock });
      expect(placed.order.subtotalPaise).toBe(v.pricePaise + 10000); // used the current price
      await getDb().variant.update({
        where: { id: v.id },
        data: { pricePaise: v.pricePaise + 99999 },
      });
      const again = await getDb().order.findUniqueOrThrow({
        where: { orderNumber: placed.order.orderNumber },
        include: { items: true },
      });
      expect(again.subtotalPaise).toBe(v.pricePaise + 10000); // unchanged
      expect(again.items[0].unitPricePaise).toBe(v.pricePaise + 10000);
      await getDb().variant.update({ where: { id: v.id }, data: { pricePaise: v.pricePaise } });
    });
  });

  describe("saved addresses", () => {
    it("uses the customer's own saved address and can save a typed one", async () => {
      const u = await newUser();
      const owner: CartOwner = { userId: u.userId };
      const [v1, v2] = await stocked(2, 30);
      const saved = await createAddress(u.userId, {
        ...address,
        fullName: "Saved Person",
        city: "Udaipur",
      });
      await cartWith(owner, [{ variantId: v1.id, qty: 1 }]);
      const a = await placeOrder({
        owner,
        user: asUser(u),
        input: input({ address: undefined, addressId: saved.id }),
        config: mock,
      });
      expect(a.order.address).toMatchObject({ fullName: "Saved Person", city: "Udaipur" });
      expect(a.order.paymentMethod).toBe("COD");

      await cartWith(owner, [{ variantId: v2.id, qty: 1 }]);
      await placeOrder({
        owner,
        user: asUser(u),
        input: input({ saveAddress: true, address: { ...address, fullName: "Typed Person" } }),
        config: mock,
      });
      expect((await listAddresses(u.userId)).map((x) => x.fullName)).toContain("Typed Person");
    });

    it("rejects someone else's saved address, and a saved address for a guest", async () => {
      const a = await newUser();
      const b = await newUser();
      const theirs = await createAddress(a.userId, address);
      const [v] = await stocked(1, 32);
      await cartWith({ userId: b.userId }, [{ variantId: v.id, qty: 1 }]);
      await expect(
        placeOrder({
          owner: { userId: b.userId },
          user: asUser(b),
          input: input({ address: undefined, addressId: theirs.id }),
          config: mock,
        }),
      ).rejects.toMatchObject({ code: "ADDRESS_NOT_FOUND" });
      const owner = guest();
      await cartWith(owner, [{ variantId: v.id, qty: 1 }]);
      await expect(
        placeOrder({
          owner,
          user: null,
          input: input({ address: undefined, addressId: theirs.id }),
          config: mock,
        }),
      ).rejects.toMatchObject({ code: "ADDRESS_NOT_FOUND" });
    });
  });

  describe("confirming payments", () => {
    async function onlineOrder(userCart?: { userId: string; user: ReturnType<typeof asUser> }) {
      const owner: CartOwner = userCart ? { userId: userCart.userId } : guest();
      const [v, extra] = await stocked(2, 40 + Math.floor(Math.random() * 20));
      await cartWith(owner, [{ variantId: v.id, qty: 2 }]);
      const placed = await placeOrder({
        owner,
        user: userCart?.user ?? null,
        input: input({ paymentMethod: "RAZORPAY" }),
        config: mock,
      });
      return { owner, placed, v, extra, providerOrderId: placed.payment!.providerOrderId };
    }

    it("marks the order paid exactly once, however many times it is told", async () => {
      const { placed, providerOrderId } = await onlineOrder();
      const first = await markPaid({
        providerOrderId,
        paymentId: "pay_1",
        amountPaise: placed.order.totalPaise,
      });
      const second = await markPaid({
        providerOrderId,
        paymentId: "pay_1",
        amountPaise: placed.order.totalPaise,
      });
      const third = await markPaid({ providerOrderId, paymentId: "pay_other" });
      expect(first).toEqual({ changed: true, found: true });
      expect(second).toEqual({ changed: false, found: true });
      expect(third.changed).toBe(false);
      const row = await getDb().order.findUniqueOrThrow({
        where: { orderNumber: placed.order.orderNumber },
      });
      expect(row).toMatchObject({
        status: "CONFIRMED",
        paymentStatus: "PAID",
        razorpayPaymentId: "pay_1",
      });
      expect(row.paidAt).not.toBeNull();
    });

    it("refuses a payment of the wrong amount and an unknown payment order", async () => {
      const { placed, providerOrderId } = await onlineOrder();
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      expect(
        await markPaid({
          providerOrderId,
          paymentId: "pay_x",
          amountPaise: placed.order.totalPaise - 1,
        }),
      ).toEqual({ changed: false, found: true });
      spy.mockRestore();
      const row = await getDb().order.findUniqueOrThrow({
        where: { orderNumber: placed.order.orderNumber },
      });
      expect(row.paymentStatus).toBe("PENDING");
      expect(
        await markPaid({ providerOrderId: "order_does_not_exist", paymentId: "pay_x" }),
      ).toEqual({ changed: false, found: false });
    });

    it("never confirms a cancelled order", async () => {
      const { placed, providerOrderId } = await onlineOrder();
      await getDb().order.update({
        where: { orderNumber: placed.order.orderNumber },
        data: { status: "CANCELLED" },
      });
      expect((await markPaid({ providerOrderId, paymentId: "pay_c" })).changed).toBe(false);
      expect(
        (
          await getDb().order.findUniqueOrThrow({
            where: { orderNumber: placed.order.orderNumber },
          })
        ).paymentStatus,
      ).toBe("PENDING");
    });

    it("removes only the purchased items from a signed-in customer's cart", async () => {
      const u = await newUser();
      const { extra, v, providerOrderId } = await onlineOrder({
        userId: u.userId,
        user: asUser(u),
      });
      await addItem({ userId: u.userId }, extra.id, 1); // added after checkout started
      await markPaid({ providerOrderId, paymentId: "pay_cart" });
      const cart = await getCartView({ userId: u.userId });
      expect(cart.lines.map((l) => l.variantId)).toEqual([extra.id]);
      expect(cart.lines.some((l) => l.variantId === v.id)).toBe(false);
    });

    it("remembers a failed attempt, and a later success clears the message", async () => {
      const { placed, providerOrderId } = await onlineOrder();
      await recordPaymentFailure(providerOrderId, "Card declined");
      let row = await getDb().order.findUniqueOrThrow({
        where: { orderNumber: placed.order.orderNumber },
      });
      expect(row).toMatchObject({ failureReason: "Card declined", status: "PENDING_PAYMENT" });
      await markPaid({ providerOrderId, paymentId: "pay_retry" });
      row = await getDb().order.findUniqueOrThrow({
        where: { orderNumber: placed.order.orderNumber },
      });
      expect(row).toMatchObject({ failureReason: null, paymentStatus: "PAID" });
      await recordPaymentFailure(providerOrderId, "late failure"); // must not touch a paid order
      row = await getDb().order.findUniqueOrThrow({
        where: { orderNumber: placed.order.orderNumber },
      });
      expect(row.failureReason).toBeNull();
    });

    it("remembers each payment notification once", async () => {
      const id = `it-evt-${randomUUID()}`;
      expect(
        await logPaymentEvent({
          provider: "razorpay",
          eventId: id,
          type: "payment.captured",
          payload: { a: 1 },
        }),
      ).toBe(true);
      expect(
        await logPaymentEvent({
          provider: "razorpay",
          eventId: id,
          type: "payment.captured",
          payload: { a: 1 },
        }),
      ).toBe(false);
    });
  });

  describe("who can see an order", () => {
    it("the owner, or anyone holding the secret token, and nobody else", async () => {
      const u = await newUser();
      const other = await newUser();
      const [v] = await stocked(1, 70);
      await cartWith({ userId: u.userId }, [{ variantId: v.id, qty: 1 }]);
      const placed = await placeOrder({
        owner: { userId: u.userId },
        user: asUser(u),
        input: input(),
        config: mock,
      });
      const n = placed.order.orderNumber;
      expect(await getAccessibleOrder({ orderNumber: n, user: asUser(u) })).not.toBeNull();
      expect(
        await getAccessibleOrder({ orderNumber: n, user: null, token: placed.token }),
      ).not.toBeNull();
      expect(await getAccessibleOrder({ orderNumber: n, user: asUser(other) })).toBeNull();
      expect(await getAccessibleOrder({ orderNumber: n, user: null })).toBeNull();
      expect(
        await getAccessibleOrder({ orderNumber: n, user: null, token: placed.token + "x" }),
      ).toBeNull();
      expect(
        await getAccessibleOrder({ orderNumber: n, user: asUser(other), token: "wrong" }),
      ).toBeNull();
      expect(await getAccessibleOrder({ orderNumber: 999999999, user: asUser(u) })).toBeNull();
    });

    it("lists a customer's own orders, newest first", async () => {
      const u = await newUser();
      const other = await newUser();
      const nums: number[] = [];
      for (let i = 0; i < 2; i++) {
        const [v] = await stocked(1, 80 + i);
        await cartWith({ userId: u.userId }, [{ variantId: v.id, qty: 1 }]);
        nums.push(
          (
            await placeOrder({
              owner: { userId: u.userId },
              user: asUser(u),
              input: input(),
              config: mock,
            })
          ).order.orderNumber,
        );
        await new Promise((r) => setTimeout(r, 15));
      }
      const list = await listOrdersForUser(u.userId);
      expect(list.map((o) => o.orderNumber)).toEqual([nums[1], nums[0]]);
      expect(await listOrdersForUser(other.userId)).toEqual([]);
    });

    it("guest orders with the same email join the account at sign-in (any letter case), others do not", async () => {
      const u = await newUser();
      const [v1, v2] = await stocked(2, 90);
      const mine = guest();
      const theirs = guest();
      await cartWith(mine, [{ variantId: v1.id, qty: 1 }]);
      await cartWith(theirs, [{ variantId: v2.id, qty: 1 }]);
      const a = await placeOrder({
        owner: mine,
        user: null,
        input: input({ email: u.email.toUpperCase() as string }),
        config: mock,
      });
      const b = await placeOrder({
        owner: theirs,
        user: null,
        input: input({ email: `someone-else-${randomUUID().slice(0, 6)}@e2e.test` }),
        config: mock,
      });
      expect(await claimGuestOrders({ id: u.userId, email: u.email })).toBe(1);
      expect((await listOrdersForUser(u.userId)).map((o) => o.orderNumber)).toEqual([
        a.order.orderNumber,
      ]);
      expect(
        (await getDb().order.findUniqueOrThrow({ where: { orderNumber: b.order.orderNumber } }))
          .userId,
      ).toBeNull();
      expect(await claimGuestOrders({ id: u.userId, email: u.email })).toBe(0);
    });

    it("keeps the order when its customer's account is deleted", async () => {
      const u = await newUser();
      const [v] = await stocked(1, 95);
      await cartWith({ userId: u.userId }, [{ variantId: v.id, qty: 1 }]);
      const placed = await placeOrder({
        owner: { userId: u.userId },
        user: asUser(u),
        input: input(),
        config: mock,
      });
      await getDb().user.delete({ where: { id: u.userId } });
      const row = await getDb().order.findUniqueOrThrow({
        where: { orderNumber: placed.order.orderNumber },
      });
      expect(row.userId).toBeNull();
    });
  });
});
