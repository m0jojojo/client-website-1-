"use client";

import { useEffect, useRef } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { authClient } from "@/lib/auth-client";
import { wishlistStore, type WishlistRemote } from "@/lib/wishlist-store";

const headers = { "Content-Type": "application/json" };

const accountWishlist: WishlistRemote = {
  add(handle) {
    void fetch(`/api/account/wishlist/${encodeURIComponent(handle)}`, {
      method: "PUT",
      headers,
    }).catch(() => {});
  },
  remove(handle) {
    void fetch(`/api/account/wishlist/${encodeURIComponent(handle)}`, {
      method: "DELETE",
      headers,
    }).catch(() => {});
  },
};

/**
 * Renders nothing. Watches the session:
 *  - on sign-in: merges the browser's cart and wishlist into the account, then shows the merged result
 *  - while signed in: mirrors wishlist changes to the account
 *  - on sign-out: clears the local wishlist and cart view so the next visitor starts clean
 */
export function AccountSync() {
  const { data, isPending } = authClient.useSession();
  const { refresh } = useCart();
  const userId = data?.user?.id ?? null;
  const previous = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (isPending) return;
    const before = previous.current;
    previous.current = userId;
    if (before === userId) return;

    if (!userId) {
      wishlistStore.setRemote(null);
      if (before) {
        wishlistStore.clear();
        void Promise.resolve().then(refresh);
      }
      return;
    }

    wishlistStore.setRemote(accountWishlist);
    let cancelled = false;
    fetch("/api/account/sync", {
      method: "POST",
      headers,
      body: JSON.stringify({ wishlist: [...wishlistStore.getSnapshot()] }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((result: { wishlist: string[] }) => {
        if (cancelled) return;
        wishlistStore.replaceAll(result.wishlist);
        return refresh();
      })
      .catch((err) => console.error("Account sync failed", err));
    return () => {
      cancelled = true;
    };
  }, [userId, isPending, refresh]);

  return null;
}
