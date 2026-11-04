import { verifyWebhookSignature } from "@/lib/payments/razorpay";
import { json } from "@/lib/orders/http";
import { logPaymentEvent, markPaid, recordPaymentFailure } from "@/lib/orders/service";

const MAX_BODY = 200_000;

type RazorpayEvent = {
  event?: string;
  payload?: {
    payment?: {
      entity?: { id?: string; order_id?: string; amount?: number; error_description?: string };
    };
    order?: { entity?: { id?: string } };
  };
};

/**
 * Razorpay tells us about payments here, even if the customer closed the tab after paying.
 * Every request must carry a valid signature over the raw body; nothing else is trusted.
 */
export async function POST(request: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return json({ error: "Webhook is not configured" }, 503);

  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ error: "Payload too large" }, 413);
  if (!verifyWebhookSignature(raw, request.headers.get("x-razorpay-signature"), secret)) {
    return json({ error: "Invalid signature" }, 401);
  }
  const eventId = request.headers.get("x-razorpay-event-id");
  if (!eventId || eventId.length > 100) return json({ error: "Missing event id" }, 400);

  let event: RazorpayEvent;
  try {
    event = JSON.parse(raw) as RazorpayEvent;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  try {
    const payment = event.payload?.payment?.entity;
    const providerOrderId = payment?.order_id ?? event.payload?.order?.entity?.id;
    if (
      (event.event === "payment.captured" || event.event === "order.paid") &&
      providerOrderId &&
      payment?.id
    ) {
      // Idempotent: a repeated or out-of-order delivery changes nothing the second time.
      await markPaid({ providerOrderId, paymentId: payment.id, amountPaise: payment.amount });
    } else if (event.event === "payment.failed" && providerOrderId) {
      await recordPaymentFailure(providerOrderId, payment?.error_description ?? "Payment failed");
    }
    const first = await logPaymentEvent({
      provider: "razorpay",
      eventId,
      type: event.event ?? "unknown",
      payload: JSON.parse(raw),
    });
    return json({ ok: true, duplicate: !first });
  } catch (err) {
    console.error("Razorpay webhook processing failed", err);
    return json({ error: "Processing failed" }, 500); // Razorpay will retry
  }
}
