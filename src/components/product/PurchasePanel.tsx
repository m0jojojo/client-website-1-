"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { discountPercent, formatRupees } from "@/lib/catalog/pricing";
import type { ProductDetail } from "@/lib/catalog/types";

export const MAX_QUANTITY = 10;

type Variant = ProductDetail["variants"][number];

export function PurchasePanel({
  title,
  variants,
  onAddToCart,
}: {
  title: string;
  variants: Variant[];
  /** Wired up in Phase 6 (cart). Until then clicking shows a "coming soon" notice. */
  onAddToCart?: (variantId: string, quantity: number) => void;
}) {
  const firstAvailable = variants.find((v) => v.inStock) ?? variants[0];
  const [variantId, setVariantId] = useState(firstAvailable?.id);
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState("");
  const qtyId = useId();

  const variant = variants.find((v) => v.id === variantId) ?? firstAvailable;
  if (!variant) return null;

  const pct = discountPercent(variant.pricePaise, variant.compareAtPricePaise);
  const showVariants = variants.length > 1;
  const clamp = (n: number) => Math.min(MAX_QUANTITY, Math.max(1, Math.floor(n) || 1));

  function add() {
    if (onAddToCart) onAddToCart(variant.id, quantity);
    else setNotice("The cart is coming soon. This button will work in the next release.");
  }

  return (
    <div>
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-2xl font-semibold" data-testid="price">
          {formatRupees(variant.pricePaise)}
        </span>
        {pct > 0 && variant.compareAtPricePaise && (
          <>
            <s
              className="text-muted text-lg"
              aria-label={`Regular price ${formatRupees(variant.compareAtPricePaise)}`}
            >
              {formatRupees(variant.compareAtPricePaise)}
            </s>
            <span className="bg-accent text-accent-foreground rounded-sm px-2 py-1 text-xs font-semibold">
              {pct}% OFF
            </span>
          </>
        )}
      </p>
      <p className="text-muted mt-1 text-xs">Taxes included.</p>

      <p className="bg-surface mt-4 rounded-sm px-3 py-2 text-sm">
        Get <strong>10% off</strong> on all prepaid orders.
      </p>

      {showVariants && (
        <fieldset className="mt-6">
          <legend className="mb-2 text-sm font-semibold">Option</legend>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => (
              <label
                key={v.id}
                className={`cursor-pointer rounded-sm border px-4 py-2 text-sm ${
                  v.id === variant.id
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-border"
                } ${v.inStock ? "" : "line-through opacity-50"}`}
              >
                <input
                  type="radio"
                  name="variant"
                  value={v.id}
                  checked={v.id === variant.id}
                  onChange={() => setVariantId(v.id)}
                  className="sr-only"
                />
                {v.title}
                {!v.inStock && <span className="sr-only"> (sold out)</span>}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="mt-6">
        <label htmlFor={qtyId} className="mb-2 block text-sm font-semibold">
          Quantity
        </label>
        <div className="border-border inline-flex items-center rounded-sm border">
          <button
            type="button"
            aria-label="Decrease quantity"
            disabled={quantity <= 1}
            onClick={() => setQuantity((q) => clamp(q - 1))}
            className="h-11 w-11 text-lg disabled:opacity-40"
          >
            &minus;
          </button>
          <input
            id={qtyId}
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_QUANTITY}
            value={quantity}
            onChange={(e) => setQuantity(clamp(Number(e.target.value)))}
            className="border-border h-11 w-14 [appearance:textfield] border-x text-center [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            type="button"
            aria-label="Increase quantity"
            disabled={quantity >= MAX_QUANTITY}
            onClick={() => setQuantity((q) => clamp(q + 1))}
            className="h-11 w-11 text-lg disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>

      <div className="mt-6">
        <Button
          size="lg"
          className="w-full"
          disabled={!variant.inStock}
          onClick={add}
          aria-describedby={notice ? "cart-notice" : undefined}
        >
          {variant.inStock ? "Add to cart" : "Sold out"}
        </Button>
        <p id="cart-notice" role="status" className="text-muted mt-3 text-sm">
          {notice}
        </p>
      </div>
      <span className="sr-only">{`Purchasing ${title}`}</span>
    </div>
  );
}
