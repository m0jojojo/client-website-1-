"use client";

import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { CartLines } from "./CartLines";
import { useCart } from "./CartProvider";
import { CartSummary } from "./CartSummary";

export function CartPage() {
  const { cart, loading, error } = useCart();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-wide uppercase">Your cart</h1>
      {error && (
        <p role="alert" className="mt-4 rounded-sm bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status" className="text-muted py-16 text-center">
          Loading your cart...
        </p>
      ) : cart.lines.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-lg font-medium">Your cart is empty.</p>
          <ButtonLink href="/collections/all" className="mt-6">
            Continue shopping
          </ButtonLink>
        </div>
      ) : (
        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_20rem]">
          <section aria-label="Items in your cart">
            <CartLines lines={cart.lines} />
            <Link
              href="/collections/all"
              className="mt-4 inline-block text-sm underline underline-offset-4"
            >
              Continue shopping
            </Link>
          </section>
          <aside aria-label="Order summary" className="border-border h-fit rounded-sm border p-4">
            <h2 className="mb-4 text-sm font-semibold tracking-wide uppercase">Order summary</h2>
            <CartSummary cart={cart} />
            <ButtonLink href="/checkout" size="lg" className="mt-4 w-full">
              Checkout
            </ButtonLink>
          </aside>
        </div>
      )}
    </div>
  );
}
