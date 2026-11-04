"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProductCard } from "@/components/catalog/ProductCard";
import { ButtonLink } from "@/components/ui/Button";
import type { ProductSummary } from "@/lib/catalog/types";
import { useWishlist } from "./useWishlist";

type State =
  { status: "loading" } | { status: "error" } | { status: "ready"; items: ProductSummary[] };

export function WishlistPage() {
  const { handles } = useWishlist();
  const key = handles.join(",");
  const [state, setState] = useState<State>({ status: "loading" });
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!key) return;
    const ctrl = new AbortController();
    fetch(`/api/products?handles=${encodeURIComponent(key)}&pageSize=60`, { signal: ctrl.signal })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<{ items: ProductSummary[] }>;
      })
      .then((data) => {
        // Keep the order the shopper saved them in (newest first).
        const order = new Map(key.split(",").map((h, i) => [h, i]));
        const items = [...data.items].sort(
          (a, b) => (order.get(a.handle) ?? 0) - (order.get(b.handle) ?? 0),
        );
        setState({ status: "ready", items });
        setLoadedKey(key);
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setState({ status: "error" });
      });
    return () => ctrl.abort();
  }, [key]);

  const items =
    state.status === "ready" ? state.items.filter((p) => handles.includes(p.handle)) : [];
  const loading = key !== "" && state.status === "loading" && loadedKey === null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-wide uppercase">Your wishlist</h1>
      {key === "" ? (
        <div className="py-16 text-center">
          <p className="text-lg font-medium">Your wishlist is empty.</p>
          <p className="text-muted mt-1 text-sm">Tap the heart on any product to save it here.</p>
          <ButtonLink href="/collections/all" className="mt-6">
            Browse all products
          </ButtonLink>
        </div>
      ) : state.status === "error" ? (
        <p role="alert" className="py-12 text-center">
          We couldn&apos;t load your wishlist right now.{" "}
          <Link href="/wishlist" className="underline">
            Try again
          </Link>
        </p>
      ) : loading ? (
        <p role="status" className="text-muted py-12 text-center">
          Loading your saved items...
        </p>
      ) : (
        <>
          <p role="status" className="text-muted mt-1 text-sm">
            {items.length} {items.length === 1 ? "item" : "items"} saved
          </p>
          <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((p) => (
              <li key={p.handle}>
                <ProductCard product={p} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
