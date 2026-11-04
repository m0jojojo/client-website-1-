import { addressPatch } from "@/lib/account/address-schema";
import { deleteAddress, listAddresses, updateAddress } from "@/lib/account/addresses";
import { errorResponse, isSameOrigin, json, readJson, requireUser } from "@/lib/account/http";

export async function PATCH(request: Request, ctx: RouteContext<"/api/account/addresses/[id]">) {
  if (!isSameOrigin(request)) return json({ error: "Forbidden" }, 403);
  const user = await requireUser();
  if (user instanceof Response) return user;
  try {
    const { id } = await ctx.params;
    const patch = addressPatch.parse(await readJson(request));
    await updateAddress(user.id, id, patch);
    return json({ items: await listAddresses(user.id) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/account/addresses/[id]">) {
  if (!isSameOrigin(request)) return json({ error: "Forbidden" }, 403);
  const user = await requireUser();
  if (user instanceof Response) return user;
  try {
    const { id } = await ctx.params;
    await deleteAddress(user.id, id);
    return json({ items: await listAddresses(user.id) });
  } catch (err) {
    return errorResponse(err);
  }
}
