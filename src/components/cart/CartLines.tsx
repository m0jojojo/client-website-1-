"use client";

import Image from "next/image";
import Link from "next/link";
import { MAX_QUANTITY } from "@/lib/cart/constants";
import type { CartLine } from "@/lib/cart/types";
import { formatRupees } from "@/lib/catalog/pricing";
import { useCart } from "./CartProvider";

export function CartLines({ lines, onNavigate }: { lines: CartLine[]; onNavigate?: () => void }) {
  const { setQuantity, removeItem, busy } = useCart();

  return (
    <ul aria-label="Cart items" className="divide-border divide-y">
      {lines.map((l) => (
        <li key={l.id} className="flex gap-4 py-4">
          <Link href={`/products/${l.handle}`} onClick={onNavigate} className="shrink-0">
            <span className="bg-surface relative block h-24 w-20 overflow-hidden rounded-sm">
              <Image
                src={l.imageUrl}
                alt={l.imageAlt}
                fill
                sizes="80px"
                unoptimized={l.imageUrl.endsWith(".svg")}
                className="object-cover"
              />
            </span>
          </Link>
          <div className="min-w-0 flex-1">
            <Link
              href={`/products/${l.handle}`}
              onClick={onNavigate}
              className="line-clamp-2 text-sm font-medium hover:underline"
            >
              {l.title}
            </Link>
            {l.variantTitle && <p className="text-muted text-xs">{l.variantTitle}</p>}
            <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-sm">
              <span className="font-semibold">{formatRupees(l.pricePaise)}</span>
              {l.compareAtPricePaise && l.compareAtPricePaise > l.pricePaise && (
                <s className="text-muted text-xs">{formatRupees(l.compareAtPricePaise)}</s>
              )}
            </p>

            {l.available ? (
              <div className="mt-2 flex items-center gap-3">
                <div className="border-border inline-flex items-center rounded-sm border">
                  <button
                    type="button"
                    aria-label={`Decrease quantity of ${l.title}`}
                    disabled={busy || l.quantity <= 1}
                    onClick={() => setQuantity(l.id, l.quantity - 1)}
                    className="h-9 w-9 disabled:opacity-40"
                  >
                    &minus;
                  </button>
                  <span
                    aria-label={`Quantity of ${l.title}`}
                    role="status"
                    className="w-8 text-center text-sm"
                  >
                    {l.quantity}
                  </span>
                  <button
                    type="button"
                    aria-label={`Increase quantity of ${l.title}`}
                    disabled={busy || l.quantity >= MAX_QUANTITY}
                    onClick={() => setQuantity(l.id, l.quantity + 1)}
                    className="h-9 w-9 disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => removeItem(l.id)}
                  aria-label={`Remove ${l.title} from cart`}
                  className="text-sm underline underline-offset-4 disabled:opacity-40"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="mt-2">
                <p className="text-sm font-medium text-red-700">
                  Sold out. Not included in your total.
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => removeItem(l.id)}
                  aria-label={`Remove ${l.title} from cart`}
                  className="mt-1 text-sm underline underline-offset-4"
                >
                  Remove
                </button>
              </div>
            )}
          </div>
          <p className="shrink-0 text-sm font-semibold">
            {l.available ? formatRupees(l.lineTotalPaise) : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}
