import { getSessionUser } from "@/lib/auth-session";
import { resolveOwnerForRead } from "@/lib/cart/http";
import { getPaymentsConfig } from "@/lib/payments/config";
import { verifyPaymentSignature } from "@/lib/payments/razorpay";
import { CheckoutError } from "@/lib/orders/errors";
import { errorResponse, isSameOrigin, json, readJson } from "@/lib/orders/http";
import { verifyInput } from "@/lib/orders/schema";
import { clearOrderedItems, getAccessibleOrder, markPaid } from "@/lib/orders/service";

/**
 * Called by the browser right after Razorpay reports a successful payment. We do not take its word
 * for it: the signature must match what only Razorpay (holding our secret) could have produced.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return json({ error: "Forbidden" }, 403);
  try {
    const body = verifyInput.parse(await readJson(request));
    const user = await getSessionUser();
    const found = await getAccessibleOrder({
      orderNumber: body.orderNumber,
      user,
      token: body.token,
    });
    if (!found) throw new CheckoutError("ORDER_NOT_FOUND", "We couldn't find that order.");
    const { row } = found;

    const config = getPaymentsConfig();
    if (config.mode === "unconfigured")
      throw new CheckoutError("PAYMENT_UNAVAILABLE", "Online payment isn't available right now.");
    if (!row.razorpayOrderId || row.razorpayOrderId !== body.razorpay_order_id) {
      throw new CheckoutError("INVALID_PAYMENT", "That payment does not belong to this order.");
    }
    const ok = verifyPaymentSignature(
      {
        orderId: body.razorpay_order_id,
        paymentId: body.razorpay_payment_id,
        signature: body.razorpay_signature,
      },
      config.keySecret,
    );
    if (!ok) throw new CheckoutError("INVALID_PAYMENT", "We couldn't confirm that payment.");

    await markPaid({
      providerOrderId: body.razorpay_order_id,
      paymentId: body.razorpay_payment_id,
    });
    await clearOrderedItems(await resolveOwnerForRead(), body.orderNumber);
    const fresh = await getAccessibleOrder({
      orderNumber: body.orderNumber,
      user,
      token: body.token,
    });
    return json({ order: fresh?.order });
  } catch (err) {
    return errorResponse(err);
  }
}
