"use client";

import Link from "next/link";
import { useWishlist } from "./useWishlist";

export function WishlistLink() {
  const { count } = useWishlist();
  return (
    <Link
      href="/wishlist"
      aria-label={count > 0 ? `Wishlist, ${count} ${count === 1 ? "item" : "items"}` : "Wishlist"}
      className="hover:bg-surface relative rounded-sm p-2"
    >
      <span aria-hidden="true">&#9825;</span>
      {count > 0 && (
        <span
          aria-hidden="true"
          className="bg-accent text-accent-foreground absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold"
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
