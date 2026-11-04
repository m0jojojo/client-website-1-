"use client";

import { useCart } from "./CartProvider";

export function CartButton() {
  const { cart, openDrawer, drawerOpen } = useCart();
  const n = cart.itemCount;
  return (
    <button
      type="button"
      onClick={openDrawer}
      aria-haspopup="dialog"
      aria-expanded={drawerOpen}
      aria-label={n > 0 ? `Cart, ${n} ${n === 1 ? "item" : "items"}` : "Cart"}
      className="hover:bg-surface relative rounded-sm p-2"
    >
      <span aria-hidden="true">&#128722;</span>
      {n > 0 && (
        <span
          aria-hidden="true"
          className="bg-accent text-accent-foreground absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold"
        >
          {n > 99 ? "99+" : n}
        </span>
      )}
    </button>
  );
}
