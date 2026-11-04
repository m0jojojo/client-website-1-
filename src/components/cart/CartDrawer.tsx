"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { buttonClasses } from "@/components/ui/Button";
import { CartLines } from "./CartLines";
import { useCart } from "./CartProvider";
import { CartSummary } from "./CartSummary";

export function CartDrawer() {
  const { cart, drawerOpen, closeDrawer, error, loading } = useCart();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (drawerOpen && !el.open) {
      if (typeof el.showModal === "function") el.showModal();
      else el.setAttribute("open", "");
    } else if (!drawerOpen && el.open) {
      if (typeof el.close === "function") el.close();
      else el.removeAttribute("open");
    }
  }, [drawerOpen]);

  return (
    <dialog
      ref={ref}
      aria-label="Shopping cart"
      onClose={closeDrawer}
      onClick={(e) => e.target === e.currentTarget && closeDrawer()}
      className="bg-background fixed inset-y-0 right-0 m-0 ml-auto h-full max-h-none w-[min(100vw,26rem)] p-0 shadow-xl backdrop:bg-black/50"
    >
      {drawerOpen && (
        <div className="flex h-full flex-col">
          <div className="border-border flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-lg font-semibold">Your cart</h2>
            <button
              type="button"
              onClick={closeDrawer}
              aria-label="Close cart"
              className="hover:bg-surface rounded-sm p-2"
            >
              <span aria-hidden="true">&#10005;</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4">
            {error && (
              <p role="alert" className="mt-3 rounded-sm bg-red-50 px-3 py-2 text-sm text-red-800">
                {error}
              </p>
            )}
            {cart.lines.length === 0 ? (
              <div className="py-16 text-center">
                <p className="font-medium">
                  {loading ? "Loading your cart..." : "Your cart is empty."}
                </p>
                {!loading && (
                  <Link
                    href="/collections/all"
                    onClick={closeDrawer}
                    className="mt-3 inline-block text-sm underline underline-offset-4"
                  >
                    Continue shopping
                  </Link>
                )}
              </div>
            ) : (
              <CartLines lines={cart.lines} onNavigate={closeDrawer} />
            )}
          </div>

          {cart.lines.length > 0 && (
            <div className="border-border space-y-4 border-t p-4">
              <CartSummary cart={cart} />
              <div className="grid gap-2">
                <Link
                  href="/checkout"
                  onClick={closeDrawer}
                  className={buttonClasses({ size: "lg" }, "w-full")}
                >
                  Checkout
                </Link>
                <Link
                  href="/cart"
                  onClick={closeDrawer}
                  className={buttonClasses({ variant: "secondary", size: "lg" }, "w-full")}
                >
                  View cart
                </Link>
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="text-sm underline underline-offset-4"
                >
                  Continue shopping
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}
