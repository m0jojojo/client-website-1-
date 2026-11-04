"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { MAX_QUANTITY } from "@/lib/cart/constants";
import { discountPercent, formatRupees } from "@/lib/catalog/pricing";
import type { ProductDetail } from "@/lib/catalog/types";

export { MAX_QUANTITY };

type Variant = ProductDetail["variants"][number];

export function PurchasePanel({
  title,
  variants,
  onAddToCart,
}: {
  title: string;
  variants: Variant[];
  /** Wired up in Phase 6 (cart). Until then clicking shows a "coming soon" notice. */
  onAddToCart?: (
    variantId: string,
    quantity: number,
  ) => void | Promise<void | { ok: boolean; message?: string }>;
}) {
  const firstAvailable = variants.find((v) => v.inStock) ?? variants[0];
  const [variantId, setVariantId] = useState(firstAvailable?.id);
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const qtyId = useId();

  // The Add to cart button moves into a bar pinned to the bottom of the screen whenever its normal
  // spot is not fully on screen (scrolled past, or still below the fold on a phone). It is the same
  // button either way, so there is never a duplicate. The slot keeps its height to avoid page jumps.
  const slot = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(false);
  useEffect(() => {
    const el = slot.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setPinned(!entry.isIntersecting || entry.intersectionRatio < 1),
      { threshold: [1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  // Tell the rest of the page (WhatsApp button, footer spacing) that the bar is showing.
  useEffect(() => {
    if (!pinned) return;
    document.body.dataset.stickyCta = "true";
    return () => {
      delete document.body.dataset.stickyCta;
    };
  }, [pinned]);

  const variant = variants.find((v) => v.id === variantId) ?? firstAvailable;
  if (!variant) return null;

  const pct = discountPercent(variant.pricePaise, variant.compareAtPricePaise);
  const showVariants = variants.length > 1;
  const clamp = (n: number) => Math.min(MAX_QUANTITY, Math.max(1, Math.floor(n) || 1));

  async function add() {
    if (!onAddToCart) {
      setNotice("The cart is coming soon. This button will work in the next release.");
      return;
    }
    setPending(true);
    setNotice("");
    try {
      const result = await onAddToCart(variant.id, quantity);
      if (result && !result.ok)
        setNotice(result.message ?? "Sorry, we couldn't add that to your cart.");
    } catch {
      setNotice("Sorry, we couldn't add that to your cart. Please try again.");
    } finally {
      setPending(false);
    }
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

      <div ref={slot} className="mt-6 min-h-12" data-pinned={pinned}>
        <div
          className={
            pinned
              ? "border-border bg-background fixed inset-x-0 bottom-0 z-30 border-t px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]"
              : undefined
          }
          data-testid="add-to-cart-bar"
        >
          <div className={pinned ? "mx-auto flex max-w-7xl items-center gap-4" : undefined}>
            {pinned && (
              <p className="shrink-0 leading-tight" aria-hidden="true">
                <span className="block text-lg font-semibold">
                  {formatRupees(variant.pricePaise)}
                </span>
                {pct > 0 && variant.compareAtPricePaise && (
                  <s className="text-muted block text-xs">
                    {formatRupees(variant.compareAtPricePaise)}
                  </s>
                )}
              </p>
            )}
            <div className={`min-w-0 flex-1 ${pinned ? "md:ml-auto md:max-w-sm" : ""}`}>
              {pinned && notice && (
                <p id="cart-notice" role="status" className="mb-2 text-sm text-red-700">
                  {notice}
                </p>
              )}
              <Button
                size="lg"
                className="w-full"
                disabled={!variant.inStock || pending}
                onClick={add}
                aria-describedby={notice ? "cart-notice" : undefined}
              >
                {!variant.inStock ? "Sold out" : pending ? "Adding..." : "Add to cart"}
              </Button>
            </div>
          </div>
        </div>
      </div>
      {!pinned && (
        <p id="cart-notice" role="status" className="text-muted mt-3 text-sm">
          {notice}
        </p>
      )}
      <span className="sr-only">{`Purchasing ${title}`}</span>
    </div>
  );
}
