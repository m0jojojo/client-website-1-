"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { formatRupees } from "@/lib/catalog/pricing";
import type { ProductSummary } from "@/lib/catalog/types";

const MIN_CHARS = 2;
const DEBOUNCE_MS = 250;

export function SearchBox() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ term: string; items: ProductSummary[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const term = query.trim();
  const active = term.length >= MIN_CHARS;

  // Debounced fetch; stale requests are aborted so slow responses never overwrite newer ones.
  useEffect(() => {
    if (!open || !active) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products?q=${encodeURIComponent(term)}&pageSize=6`, {
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`Search failed (${res.status})`);
        const data: { items: ProductSummary[] } = await res.json();
        setResults({ term, items: data.items });
        setFailed(false);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setFailed(true);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [open, active, term]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const items = active && results?.term === term ? results.items : [];
  const loading = active && !failed && results?.term !== term;
  const close = () => setOpen(false);

  let status = "";
  if (active) {
    if (failed) status = "Suggestions are unavailable. Press Enter to search.";
    else if (loading) status = "Searching";
    else status = items.length ? `${items.length} suggestions` : "No suggestions";
  }

  return (
    <div ref={root} className="relative">
      <button
        ref={toggle}
        type="button"
        aria-label="Search"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="hover:bg-surface rounded-sm p-2"
      >
        <span aria-hidden="true">&#128269;</span>
      </button>

      {open && (
        <div
          id={panelId}
          className="border-border bg-background absolute top-full right-0 z-50 mt-2 w-[min(92vw,26rem)] border p-3 shadow-lg"
        >
          <form
            action="/search"
            method="get"
            role="search"
            aria-label="Search products"
            className="flex gap-2"
          >
            <label className="flex-1">
              <span className="sr-only">Search products</span>
              <input
                type="search"
                name="q"
                autoFocus
                autoComplete="off"
                maxLength={100}
                required
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search sarees, suits..."
                className="border-border h-10 w-full rounded-sm border px-3"
              />
            </label>
            <button
              type="submit"
              className="bg-accent text-accent-foreground h-10 rounded-sm px-4 text-sm font-medium"
            >
              Search
            </button>
          </form>

          <p role="status" className="sr-only">
            {status}
          </p>

          {active && items.length > 0 && (
            <>
              <ul aria-label="Search suggestions" className="divide-border mt-3 divide-y">
                {items.map((p) => (
                  <li key={p.handle}>
                    <Link
                      href={`/products/${p.handle}`}
                      onClick={close}
                      className="hover:bg-surface flex items-baseline justify-between gap-3 py-2 text-sm"
                    >
                      <span className="line-clamp-1">{p.title}</span>
                      <span className="shrink-0 font-medium">{formatRupees(p.pricePaise)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href={`/search?q=${encodeURIComponent(term)}`}
                onClick={close}
                className="mt-2 block text-sm font-medium underline underline-offset-4"
              >
                See all results for &ldquo;{term}&rdquo;
              </Link>
            </>
          )}
          {active && !loading && !failed && items.length === 0 && (
            <p className="text-muted mt-3 text-sm">No products found for &ldquo;{term}&rdquo;.</p>
          )}
        </div>
      )}
    </div>
  );
}
