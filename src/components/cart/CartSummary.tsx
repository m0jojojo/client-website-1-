"use client";

import { formatRupees } from "@/lib/catalog/pricing";
import type { CartView } from "@/lib/cart/types";

export function CartSummary({ cart }: { cart: CartView }) {
  return (
    <div className="space-y-2 text-sm">
      {cart.savingsPaise > 0 && (
        <p className="flex justify-between text-green-800">
          <span>You save</span>
          <span>{formatRupees(cart.savingsPaise)}</span>
        </p>
      )}
      <p className="flex justify-between text-base font-semibold">
        <span>Subtotal</span>
        <span data-testid="subtotal">{formatRupees(cart.subtotalPaise)}</span>
      </p>
      <p className="text-muted text-xs">
        Shipping is free. Get 10% off on prepaid orders at checkout. Taxes included.
      </p>
    </div>
  );
}
