import Link from "next/link";
import { ProductCard } from "@/components/catalog/ProductCard";
import type { Facets, ListingState, Page, ProductSummary } from "@/lib/catalog";
import { listingQuery } from "@/lib/catalog";
import { ActiveFilters } from "./ActiveFilters";
import { FilterForm } from "./FilterForm";
import { FilterToggle } from "./FilterToggle";
import { Pagination } from "./Pagination";

export function ListingView({
  title,
  countLabel,
  basePath,
  state,
  result,
  facets,
  emptyMessage = "No products match your filters.",
}: {
  title: string;
  countLabel: string;
  basePath: string;
  state: ListingState;
  result: Page<ProductSummary>;
  facets: Facets;
  emptyMessage?: string;
}) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-wide uppercase">{title}</h1>
      <p className="text-muted mt-1 text-sm" role="status">
        {countLabel}
      </p>

      <div className="mt-6 grid gap-8 lg:grid-cols-[16rem_1fr]">
        <aside aria-label="Filters">
          <FilterToggle>
            <FilterForm basePath={basePath} state={state} facets={facets} />
          </FilterToggle>
        </aside>

        <section aria-label="Products" className="min-w-0">
          <ActiveFilters basePath={basePath} state={state} />
          {result.items.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-lg font-medium">{emptyMessage}</p>
              <Link
                href={`${basePath}${listingQuery({ q: state.q })}`}
                className="mt-3 inline-block text-sm underline underline-offset-4"
              >
                {state.page > 1 ? "Back to first page" : "Clear all filters"}
              </Link>
            </div>
          ) : (
            <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 xl:grid-cols-4">
              {result.items.map((p) => (
                <li key={p.handle}>
                  <ProductCard product={p} />
                </li>
              ))}
            </ul>
          )}
          <Pagination basePath={basePath} state={state} totalPages={result.totalPages} />
        </section>
      </div>
    </div>
  );
}

export function ListingSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8" aria-hidden="true">
      <div className="bg-surface h-8 w-64 animate-pulse rounded" />
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-surface aspect-[4/5] animate-pulse rounded" />
        ))}
      </div>
    </div>
  );
}
