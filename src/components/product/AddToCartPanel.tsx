"use client";

import { useCart } from "@/components/cart/CartProvider";
import { PurchasePanel } from "./PurchasePanel";
import type { ProductDetail } from "@/lib/catalog/types";

/** Connects the purchase panel to the real cart. */
export function AddToCartPanel({
  title,
  variants,
}: {
  title: string;
  variants: ProductDetail["variants"];
}) {
  const { addItem } = useCart();
  return <PurchasePanel title={title} variants={variants} onAddToCart={addItem} />;
}
