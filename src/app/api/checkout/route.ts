import { getSessionUser } from "@/lib/auth-session";
import { resolveOwnerForRead } from "@/lib/cart/http";
import { CheckoutError } from "@/lib/orders/errors";
import { errorResponse, isSameOrigin, json, readJson } from "@/lib/orders/http";
import { checkoutInput } from "@/lib/orders/schema";
import { placeOrder } from "@/lib/orders/service";

/** Places an order from the visitor's cart. The browser sends who/where/how; the server decides the money. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return json({ error: "Forbidden" }, 403);
  try {
    const input = checkoutInput.parse(await readJson(request));
    const user = await getSessionUser();
    const owner = await resolveOwnerForRead();
    if (!owner) throw new CheckoutError("EMPTY_CART", "Your cart is empty.");
    const placed = await placeOrder({ owner, user, input });
    return json(placed);
  } catch (err) {
    return errorResponse(err);
  }
}
