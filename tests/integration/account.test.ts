import type { AddressInput } from "@/lib/account/address-schema";
import {
  MAX_ADDRESSES,
  createAddress,
  deleteAddress,
  listAddresses,
  updateAddress,
} from "@/lib/account/addresses";
import {
  MAX_ACCOUNT_WISHLIST,
  addWishlistItem,
  listWishlistHandles,
  mergeWishlist,
  removeWishlistItem,
} from "@/lib/account/wishlist";
import { getAuth } from "@/lib/auth";
import { MAX_QUANTITY } from "@/lib/cart/constants";
import {
  addItem,
  deleteCarts,
  ensureCart,
  getCartView,
  mergeGuestCartIntoUser,
} from "@/lib/cart/service";
import { generateCartToken, hashCartToken } from "@/lib/cart/token";
import { getDb } from "@/lib/db";
import {
  SESSION_COOKIE,
  createTestUser,
  deleteTestUsers,
  signCookieValue,
} from "../helpers/test-user";

const hasDb = !!process.env.DATABASE_URL && !!process.env.BETTER_AUTH_SECRET;
const users: string[] = [];
const guestHashes: string[] = [];

const newUser = async () => {
  const u = await createTestUser();
  users.push(u.userId);
  return u;
};
const newGuest = () => {
  const tokenHash = hashCartToken(generateCartToken());
  guestHashes.push(tokenHash);
  return { tokenHash };
};

const addr = (over: Partial<AddressInput> = {}): AddressInput => ({
  fullName: "Asha Verma",
  phone: "9876543210",
  line1: "12 Mansarovar Colony",
  city: "Jaipur",
  state: "Rajasthan",
  pincode: "302020",
  ...over,
});

describe.skipIf(!hasDb)("accounts (real database)", () => {
  afterAll(async () => {
    await deleteCarts(guestHashes);
    await deleteTestUsers(users);
    await getDb().$disconnect();
  });

  describe("sessions", () => {
    it("accepts a correctly signed session cookie and identifies the user", async () => {
      const u = await newUser();
      const session = await getAuth().api.getSession({
        headers: new Headers({ cookie: `${u.cookie.name}=${u.cookie.value}` }),
      });
      expect(session?.user.id).toBe(u.userId);
      expect(session?.user.email).toBe(u.email);
    });

    it("rejects tampered, wrongly signed, unsigned and expired cookies", async () => {
      const u = await newUser();
      const get = (value: string) =>
        getAuth().api.getSession({
          headers: new Headers({ cookie: `${SESSION_COOKIE}=${value}` }),
        });
      expect(await get(u.cookie.value.slice(0, -4) + "AAAA")).toBeNull();
      expect(await get(signCookieValue(u.token, "a-different-secret"))).toBeNull();
      expect(await get(encodeURIComponent(u.token))).toBeNull();
      expect(
        await get(signCookieValue("not-a-real-token", process.env.BETTER_AUTH_SECRET!)),
      ).toBeNull();
      await getDb().session.updateMany({
        where: { userId: u.userId },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      expect(await get(u.cookie.value)).toBeNull();
    });

    it("deleting a user removes their sessions, cart, addresses and wishlist", async () => {
      const u = await newUser();
      await createAddress(u.userId, addr());
      await ensureCart({ userId: u.userId });
      const p = await getDb().product.findFirstOrThrow({ where: { published: true } });
      await addWishlistItem(u.userId, p.handle);
      await getDb().user.delete({ where: { id: u.userId } });
      const db = getDb();
      expect(await db.session.count({ where: { userId: u.userId } })).toBe(0);
      expect(await db.address.count({ where: { userId: u.userId } })).toBe(0);
      expect(await db.cart.count({ where: { userId: u.userId } })).toBe(0);
      expect(await db.wishlistItem.count({ where: { userId: u.userId } })).toBe(0);
    });
  });

  describe("addresses", () => {
    it("the first address becomes the default, later ones do not", async () => {
      const u = await newUser();
      const first = await createAddress(u.userId, addr());
      const second = await createAddress(u.userId, addr({ fullName: "Meera" }));
      expect(first.isDefault).toBe(true);
      expect(second.isDefault).toBe(false);
      const list = await listAddresses(u.userId);
      expect(list.map((a) => a.fullName)).toEqual(["Asha Verma", "Meera"]); // default first
    });

    it("creating or updating with isDefault moves the default; there is always exactly one", async () => {
      const u = await newUser();
      const a = await createAddress(u.userId, addr());
      const b = await createAddress(u.userId, addr({ fullName: "B", isDefault: true }));
      let list = await listAddresses(u.userId);
      expect(list.filter((x) => x.isDefault).map((x) => x.id)).toEqual([b.id]);
      await updateAddress(u.userId, a.id, { isDefault: true });
      list = await listAddresses(u.userId);
      expect(list.filter((x) => x.isDefault).map((x) => x.id)).toEqual([a.id]);
      // asking to un-default the only default is ignored
      await updateAddress(u.userId, a.id, { isDefault: false, city: "Udaipur" });
      list = await listAddresses(u.userId);
      expect(list.find((x) => x.id === a.id)).toMatchObject({ isDefault: true, city: "Udaipur" });
    });

    it("deleting the default promotes another address", async () => {
      const u = await newUser();
      const a = await createAddress(u.userId, addr());
      const b = await createAddress(u.userId, addr({ fullName: "B" }));
      await deleteAddress(u.userId, a.id);
      const list = await listAddresses(u.userId);
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({ id: b.id, isDefault: true });
      await deleteAddress(u.userId, b.id);
      expect(await listAddresses(u.userId)).toEqual([]);
    });

    it("stops at the maximum number of addresses", async () => {
      const u = await newUser();
      for (let i = 0; i < MAX_ADDRESSES; i++)
        await createAddress(u.userId, addr({ fullName: `Person ${i}` }));
      await expect(createAddress(u.userId, addr())).rejects.toMatchObject({
        code: "LIMIT_REACHED",
      });
      expect(await listAddresses(u.userId)).toHaveLength(MAX_ADDRESSES);
    }, 60_000);

    it("customers cannot see, change or delete each other's addresses", async () => {
      const a = await newUser();
      const b = await newUser();
      const mine = await createAddress(a.userId, addr({ fullName: "Private" }));
      expect(await listAddresses(b.userId)).toEqual([]);
      await expect(updateAddress(b.userId, mine.id, { city: "Hacked" })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      await expect(deleteAddress(b.userId, mine.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect((await listAddresses(a.userId))[0]).toMatchObject({
        fullName: "Private",
        city: "Jaipur",
      });
    });
  });

  describe("account wishlist", () => {
    const handles = async (n: number) =>
      (
        await getDb().product.findMany({
          where: { published: true },
          take: n,
          orderBy: { id: "asc" },
        })
      ).map((p) => p.handle);

    it("adds, lists newest first, is idempotent, and removes", async () => {
      const u = await newUser();
      const [h1, h2] = await handles(2);
      await addWishlistItem(u.userId, h1);
      await new Promise((r) => setTimeout(r, 15));
      await addWishlistItem(u.userId, h2);
      await addWishlistItem(u.userId, h2);
      expect(await listWishlistHandles(u.userId)).toEqual([h2, h1]);
      await removeWishlistItem(u.userId, h2);
      await removeWishlistItem(u.userId, h2);
      expect(await listWishlistHandles(u.userId)).toEqual([h1]);
    });

    it("refuses unknown products", async () => {
      const u = await newUser();
      await expect(addWishlistItem(u.userId, "no-such-product")).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });

    it("merging adds new items in the browser's order, skips unknown and duplicate handles", async () => {
      const u = await newUser();
      const [h1, h2, h3] = await handles(3);
      await addWishlistItem(u.userId, h3);
      await mergeWishlist(u.userId, [h1, "ghost", h2, h1, h3]);
      const list = await listWishlistHandles(u.userId);
      expect(new Set(list)).toEqual(new Set([h1, h2, h3]));
      expect(list).toHaveLength(3);
      expect(list.indexOf(h1)).toBeLessThan(list.indexOf(h2)); // browser order kept for the new ones
      await mergeWishlist(u.userId, [h1, h2]); // idempotent
      expect(await listWishlistHandles(u.userId)).toHaveLength(3);
      await mergeWishlist(u.userId, []);
    });

    it("never stores more than the maximum", async () => {
      expect(MAX_ACCOUNT_WISHLIST).toBe(200);
      const u = await newUser();
      const all = (
        await getDb().product.findMany({ where: { published: true }, select: { handle: true } })
      ).map((p) => p.handle);
      await mergeWishlist(u.userId, all.slice(0, 250));
      expect((await listWishlistHandles(u.userId)).length).toBeLessThanOrEqual(
        MAX_ACCOUNT_WISHLIST,
      );
    }, 60_000);

    it("customers have separate wishlists", async () => {
      const a = await newUser();
      const b = await newUser();
      const [h1] = await handles(1);
      await addWishlistItem(a.userId, h1);
      expect(await listWishlistHandles(b.userId)).toEqual([]);
    });
  });

  describe("guest cart merging", () => {
    const variants = () =>
      getDb().variant.findMany({ where: { inStock: true }, take: 4, orderBy: { id: "asc" } });

    it("a signed-in customer has one cart, separate from any guest cart", async () => {
      const u = await newUser();
      const guest = newGuest();
      const [v] = await variants();
      await addItem({ userId: u.userId }, v.id, 1);
      await addItem(guest, v.id, 3);
      expect((await getCartView({ userId: u.userId })).itemCount).toBe(1);
      expect((await getCartView(guest)).itemCount).toBe(3);
      const a = await ensureCart({ userId: u.userId });
      const b = await ensureCart({ userId: u.userId });
      expect(a.id).toBe(b.id);
    });

    it("merging adds quantities, caps them, keeps other lines and deletes the guest cart", async () => {
      const u = await newUser();
      const guest = newGuest();
      const [v1, v2, v3] = await variants();
      await addItem({ userId: u.userId }, v1.id, 8);
      await addItem({ userId: u.userId }, v2.id, 2);
      await addItem(guest, v1.id, 5); // 8 + 5 -> capped at 10
      await addItem(guest, v3.id, 1); // new line
      await mergeGuestCartIntoUser(guest.tokenHash, u.userId);
      const cart = await getCartView({ userId: u.userId });
      const qty = Object.fromEntries(cart.lines.map((l) => [l.variantId, l.quantity]));
      expect(qty).toEqual({ [v1.id]: MAX_QUANTITY, [v2.id]: 2, [v3.id]: 1 });
      expect((await getCartView(guest)).lines).toEqual([]);
      expect(await getDb().cart.count({ where: { tokenHash: guest.tokenHash } })).toBe(0);
    });

    it("is safe to run twice and harmless for empty or unknown guest carts", async () => {
      const u = await newUser();
      const guest = newGuest();
      const [v1] = await variants();
      await addItem(guest, v1.id, 2);
      await mergeGuestCartIntoUser(guest.tokenHash, u.userId);
      await mergeGuestCartIntoUser(guest.tokenHash, u.userId);
      expect((await getCartView({ userId: u.userId })).itemCount).toBe(2);

      const empty = newGuest();
      await ensureCart(empty);
      await mergeGuestCartIntoUser(empty.tokenHash, u.userId);
      expect(await getDb().cart.count({ where: { tokenHash: empty.tokenHash } })).toBe(0);
      await mergeGuestCartIntoUser(hashCartToken(generateCartToken()), u.userId);
      expect((await getCartView({ userId: u.userId })).itemCount).toBe(2);
    });

    it("a customer can only change lines in their own cart", async () => {
      const a = await newUser();
      const b = await newUser();
      const [v] = await variants();
      await addItem({ userId: a.userId }, v.id, 1);
      const line = (await getCartView({ userId: a.userId })).lines[0];
      const { setItemQuantity } = await import("@/lib/cart/service");
      await expect(setItemQuantity({ userId: b.userId }, line.id, 5)).rejects.toMatchObject({
        code: "ITEM_NOT_FOUND",
      });
      expect((await getCartView({ userId: a.userId })).lines[0].quantity).toBe(1);
    });
  });
});
