import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { PaymentsConfig } from "./config";

export class PaymentProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentProviderError";
  }
}

const hmacHex = (secret: string, data: string) =>
  createHmac("sha256", secret).update(data).digest("hex");

/** Constant-time comparison of two hex strings (so timing cannot reveal a correct signature). */
export function safeEqualHex(a: string, b: string): boolean {
  if (!/^[0-9a-f]+$/i.test(a) || !/^[0-9a-f]+$/i.test(b)) return false;
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

/** Razorpay signs "<razorpay_order_id>|<razorpay_payment_id>" with your key secret. */
export function signPayment(orderId: string, paymentId: string, keySecret: string): string {
  return hmacHex(keySecret, `${orderId}|${paymentId}`);
}

export function verifyPaymentSignature(
  p: { orderId: string; paymentId: string; signature: string },
  keySecret: string,
): boolean {
  return safeEqualHex(signPayment(p.orderId, p.paymentId, keySecret), p.signature);
}

/** Webhooks are signed with the webhook secret over the exact raw request body. */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  webhookSecret: string,
): boolean {
  if (!signature || !webhookSecret) return false;
  return safeEqualHex(hmacHex(webhookSecret, rawBody), signature);
}

export type ProviderOrder = { id: string; amountPaise: number; currency: "INR" };

/** Creates the payment order at Razorpay (or a local fake in mock mode). Amount is in paise. */
export async function createProviderOrder(
  args: { amountPaise: number; receipt: string; notes?: Record<string, string> },
  config: Exclude<PaymentsConfig, { mode: "unconfigured" }>,
  fetchImpl: typeof fetch = fetch,
): Promise<ProviderOrder> {
  if (!Number.isInteger(args.amountPaise) || args.amountPaise < 100) {
    throw new PaymentProviderError("The amount must be at least ₹1.");
  }
  if (config.mode === "mock") {
    return {
      id: `order_mock_${randomBytes(9).toString("hex")}`,
      amountPaise: args.amountPaise,
      currency: "INR",
    };
  }
  let res: Response;
  try {
    res = await fetchImpl("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64")}`,
      },
      body: JSON.stringify({
        amount: args.amountPaise,
        currency: "INR",
        receipt: args.receipt.slice(0, 40),
        notes: args.notes ?? {},
      }),
    });
  } catch {
    throw new PaymentProviderError("We couldn't reach the payment service. Please try again.");
  }
  if (!res.ok) {
    // Never pass the provider's raw error to customers; it can mention keys or internals.
    console.error("Razorpay order creation failed", res.status, await res.text().catch(() => ""));
    throw new PaymentProviderError(
      "We couldn't start the payment. Please try again or choose cash on delivery.",
    );
  }
  const data = (await res.json()) as { id?: string; amount?: number; currency?: string };
  if (!data.id || data.amount !== args.amountPaise) {
    throw new PaymentProviderError(
      "The payment service returned an unexpected answer. Please try again.",
    );
  }
  return { id: data.id, amountPaise: data.amount, currency: "INR" };
}
