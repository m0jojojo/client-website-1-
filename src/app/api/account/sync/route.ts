import { z } from "zod";
import { errorResponse, isSameOrigin, json, readJson, requireUser } from "@/lib/account/http";
import { listWishlistHandles, mergeWishlist } from "@/lib/account/wishlist";
import { clearCartCookie, readTokenHash } from "@/lib/cart/http";
import { getCartView, mergeGuestCartIntoUser } from "@/lib/cart/service";

const body = z.object({
  wishlist: z.array(z.string().trim().min(1).max(200)).max(200).default([]),
});

/**
 * Called once after sign-in: folds the browser's guest cart and wishlist into the account,
 * and returns the account's merged state. Safe to call repeatedly.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return json({ error: "Forbidden" }, 403);
  const user = await requireUser();
  if (user instanceof Response) return user;
  try {
    const { wishlist } = body.parse(await readJson(request));
    const tokenHash = await readTokenHash();
    if (tokenHash) {
      await mergeGuestCartIntoUser(tokenHash, user.id);
      await clearCartCookie();
    }
    await mergeWishlist(user.id, wishlist);
    return json({
      wishlist: await listWishlistHandles(user.id),
      cart: await getCartView({ userId: user.id }),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
