"use client";

import { useSyncExternalStore } from "react";
import { wishlistStore } from "@/lib/wishlist-store";

export function useWishlist() {
  const handles = useSyncExternalStore(
    wishlistStore.subscribe,
    wishlistStore.getSnapshot,
    wishlistStore.getServerSnapshot,
  );
  return {
    handles,
    count: handles.length,
    has: (handle: string) => handles.includes(handle),
    toggle: wishlistStore.toggle,
    remove: wishlistStore.remove,
  };
}
