"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { EMPTY_CART, type CartView } from "@/lib/cart/types";

export type CartResult = { ok: true } | { ok: false; message: string };

type CartContextValue = {
  cart: CartView;
  /** true until the first load finishes */
  loading: boolean;
  /** true while a change is being saved */
  busy: boolean;
  error: string | null;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  addItem: (variantId: string, quantity: number) => Promise<CartResult>;
  setQuantity: (itemId: string, quantity: number) => Promise<CartResult>;
  removeItem: (itemId: string) => Promise<CartResult>;
  refresh: () => Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);

async function request(url: string, init?: RequestInit): Promise<CartView> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(typeof data.error === "string" ? data.error : "Something went wrong.");
  return data as CartView;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartView>(EMPTY_CART);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const next = await request("/api/cart");
      if (mounted.current) setCart(next);
      setError(null);
    } catch {
      if (mounted.current) setError("We couldn't load your cart.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  // Initial load. State is only set from the promise callbacks, never synchronously in the effect.
  useEffect(() => {
    let active = true;
    request("/api/cart")
      .then((next) => {
        if (!active) return;
        setCart(next);
        setError(null);
      })
      .catch(() => {
        if (active) setError("We couldn't load your cart.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const mutate = useCallback(async (fn: () => Promise<CartView>): Promise<CartResult> => {
    setPending((n) => n + 1);
    try {
      const next = await fn();
      if (mounted.current) {
        setCart(next);
        setError(null);
      }
      return { ok: true };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong.";
      if (mounted.current) setError(message);
      return { ok: false, message };
    } finally {
      if (mounted.current) setPending((n) => n - 1);
    }
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      loading,
      busy: pending > 0,
      error,
      drawerOpen,
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
      refresh,
      addItem: async (variantId, quantity) => {
        const result = await mutate(() =>
          request("/api/cart/items", {
            method: "POST",
            body: JSON.stringify({ variantId, quantity }),
          }),
        );
        if (result.ok) setDrawerOpen(true);
        return result;
      },
      setQuantity: (itemId, quantity) =>
        mutate(() =>
          request(`/api/cart/items/${encodeURIComponent(itemId)}`, {
            method: "PATCH",
            body: JSON.stringify({ quantity }),
          }),
        ),
      removeItem: (itemId) =>
        mutate(() =>
          request(`/api/cart/items/${encodeURIComponent(itemId)}`, { method: "DELETE" }),
        ),
    }),
    [cart, loading, pending, error, drawerOpen, mutate, refresh],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
