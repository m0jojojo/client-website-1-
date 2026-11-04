import { z } from "zod";
import { MAX_QUANTITY } from "@/lib/cart/constants";
import { errorResponse, isSameOrigin, json, readJson, resolveOwnerForRead } from "@/lib/cart/http";
import { getCartView, removeItem, setItemQuantity } from "@/lib/cart/service";
import { CartError } from "@/lib/cart/types";

const body = z.object({ quantity: z.number().int().min(0).max(MAX_QUANTITY) });

export async function PATCH(request: Request, ctx: RouteContext<"/api/cart/items/[id]">) {
  if (!isSameOrigin(request)) return json({ error: "Forbidden" }, 403);
  try {
    const { id } = await ctx.params;
    const { quantity } = body.parse(await readJson(request));
    const owner = await resolveOwnerForRead();
    if (!owner) throw new CartError("ITEM_NOT_FOUND", "That item is not in your cart.");
    await setItemQuantity(owner, id, quantity);
    return json(await getCartView(owner));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/cart/items/[id]">) {
  if (!isSameOrigin(request)) return json({ error: "Forbidden" }, 403);
  try {
    const { id } = await ctx.params;
    const owner = await resolveOwnerForRead();
    if (!owner) throw new CartError("ITEM_NOT_FOUND", "That item is not in your cart.");
    await removeItem(owner, id);
    return json(await getCartView(owner));
  } catch (err) {
    return errorResponse(err);
  }
}
