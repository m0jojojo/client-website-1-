import { z } from "zod";
import { MAX_QUANTITY } from "@/lib/cart/constants";
import { errorResponse, isSameOrigin, json, readJson, tokenHashForWrite } from "@/lib/cart/http";
import { addItem, getCartView } from "@/lib/cart/service";

const body = z.object({
  variantId: z.string().trim().min(1).max(64),
  quantity: z.number().int().min(1).max(MAX_QUANTITY).default(1),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return json({ error: "Forbidden" }, 403);
  try {
    const { variantId, quantity } = body.parse(await readJson(request));
    const tokenHash = await tokenHashForWrite();
    await addItem(tokenHash, variantId, quantity);
    return json(await getCartView(tokenHash));
  } catch (err) {
    return errorResponse(err);
  }
}
