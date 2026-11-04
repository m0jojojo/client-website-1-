import { connection } from "next/server";
import { getCartView } from "@/lib/cart/service";
import { errorResponse, json, resolveOwnerForRead } from "@/lib/cart/http";

export async function GET() {
  // The cart depends on the visitor's cookie or session, so this must never be prerendered.
  await connection();
  try {
    return json(await getCartView(await resolveOwnerForRead()));
  } catch (err) {
    return errorResponse(err);
  }
}
