import { randomBytes } from "node:crypto";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth-session";
import { getPaymentsConfig } from "@/lib/payments/config";
import { signPayment } from "@/lib/payments/razorpay";
import { CheckoutError } from "@/lib/orders/errors";
import { errorResponse, isSameOrigin, json, readJson } from "@/lib/orders/http";
import { getAccessibleOrder, recordPaymentFailure } from "@/lib/orders/service";

const body = z
  .object({
    orderNumber: z.number().int().positive(),
    token: z.string().trim().max(128).optional(),
    outcome: z.enum(["success", "failure"]),
  })
  .strict();

/**
 * Local-development stand-in for the Razorpay pay screen. It exists only in mock mode (which needs
 * PAYMENTS_MOCK=true and a localhost site URL); everywhere else it simply does not exist.
 */
export async function POST(request: Request) {
  const config = getPaymentsConfig();
  if (config.mode !== "mock") return json({ error: "Not found" }, 404);
  if (!isSameOrigin(request)) return json({ error: "Forbidden" }, 403);
  try {
    const { orderNumber, token, outcome } = body.parse(await readJson(request));
    const found = await getAccessibleOrder({ orderNumber, user: await getSessionUser(), token });
    if (!found?.row.razorpayOrderId || found.row.status !== "PENDING_PAYMENT") {
      throw new CheckoutError("ORDER_NOT_FOUND", "We couldn't find a payable order.");
    }
    if (outcome === "failure") {
      await recordPaymentFailure(found.row.razorpayOrderId, "Test payment declined");
      return json({ failed: true, reason: "Test payment declined" });
    }
    const paymentId = `pay_mock_${randomBytes(9).toString("hex")}`;
    return json({
      razorpay_order_id: found.row.razorpayOrderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signPayment(found.row.razorpayOrderId, paymentId, config.keySecret),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
