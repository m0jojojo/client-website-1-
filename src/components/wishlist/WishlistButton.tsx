"use client";

import { useWishlist } from "./useWishlist";

export function WishlistButton({
  handle,
  title,
  className = "",
  withLabel = false,
}: {
  handle: string;
  title: string;
  className?: string;
  /** Show "Add to wishlist" text next to the heart (product page). */
  withLabel?: boolean;
}) {
  const { has, toggle } = useWishlist();
  const saved = has(handle);
  const label = saved ? `Remove ${title} from wishlist` : `Add ${title} to wishlist`;

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={label}
      onClick={() => toggle(handle)}
      className={`flex items-center gap-2 ${
        withLabel
          ? "border-border hover:bg-surface h-11 rounded-sm border px-4 text-sm font-medium"
          : "bg-background/90 hover:bg-background h-9 w-9 justify-center rounded-full shadow"
      } ${className}`}
    >
      <span aria-hidden="true" className={saved ? "text-red-600" : ""}>
        {saved ? "♥" : "♡"}
      </span>
      {withLabel && <span>{saved ? "Saved to wishlist" : "Add to wishlist"}</span>}
    </button>
  );
}
