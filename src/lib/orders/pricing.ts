export const PREPAID_DISCOUNT_PERCENT = 10;

export type PaymentMethodKey = "RAZORPAY" | "COD";

export type Totals = {
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  totalPaise: number;
};

/**
 * What the customer pays. Online (prepaid) orders get 10% off the subtotal; cash on delivery pays
 * the full price. Shipping is free. Prices already include tax. All amounts are whole paise.
 */
export function computeTotals(subtotalPaise: number, method: PaymentMethodKey): Totals {
  const discountPaise =
    method === "RAZORPAY" ? Math.round((subtotalPaise * PREPAID_DISCOUNT_PERCENT) / 100) : 0;
  const shippingPaise = 0;
  return {
    subtotalPaise,
    discountPaise,
    shippingPaise,
    totalPaise: subtotalPaise - discountPaise + shippingPaise,
  };
}

/** The order number customers see, e.g. 1001 -> "BB1001". */
export function orderLabel(orderNumber: number): string {
  return `BB${orderNumber}`;
}

/** The inverse of orderLabel, accepting "BB1001" or "1001". Returns null for anything else. */
export function parseOrderLabel(value: string): number | null {
  const m = /^(?:BB)?(\d{1,9})$/i.exec(value.trim());
  return m ? Number(m[1]) : null;
}
