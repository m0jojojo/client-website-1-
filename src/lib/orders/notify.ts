import type { OrderView } from "./schema";

/**
 * Called when an order is confirmed (cash on delivery placed, or online payment received).
 * Customer emails are not switched on yet, so for now this only writes to the server log.
 * When email sending (Resend) is added, send the confirmation from here.
 */
export function notifyOrderConfirmed(
  order: Pick<OrderView, "label" | "email" | "totalPaise" | "paymentMethod">,
) {
  if (process.env.NODE_ENV === "test" || process.env.VITEST) return;
  console.info(
    `[order] ${order.label} confirmed (${order.paymentMethod}), total ${order.totalPaise / 100} INR, customer ${order.email}`,
  );
}
