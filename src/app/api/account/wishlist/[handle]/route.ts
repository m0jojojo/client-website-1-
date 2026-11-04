import { errorResponse, isSameOrigin, json, requireUser } from "@/lib/account/http";
import { addWishlistItem, listWishlistHandles, removeWishlistItem } from "@/lib/account/wishlist";

export async function PUT(request: Request, ctx: RouteContext<"/api/account/wishlist/[handle]">) {
  if (!isSameOrigin(request)) return json({ error: "Forbidden" }, 403);
  const user = await requireUser();
  if (user instanceof Response) return user;
  try {
    const { handle } = await ctx.params;
    await addWishlistItem(user.id, handle);
    return json({ wishlist: await listWishlistHandles(user.id) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(
  request: Request,
  ctx: RouteContext<"/api/account/wishlist/[handle]">,
) {
  if (!isSameOrigin(request)) return json({ error: "Forbidden" }, 403);
  const user = await requireUser();
  if (user instanceof Response) return user;
  try {
    const { handle } = await ctx.params;
    await removeWishlistItem(user.id, handle);
    return json({ wishlist: await listWishlistHandles(user.id) });
  } catch (err) {
    return errorResponse(err);
  }
}
