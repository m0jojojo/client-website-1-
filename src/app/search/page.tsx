import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ListingSkeleton, ListingView } from "@/components/listing/ListingView";
import { SearchForm } from "@/components/listing/SearchForm";
import { getFacets, listProducts, listingQuery } from "@/lib/catalog";
import { parseListingState, toListOptions } from "@/lib/catalog/params";

export const metadata: Metadata = { title: "Search", robots: { index: false } };

export default function SearchPage(props: PageProps<"/search">) {
  return (
    <Suspense fallback={<ListingSkeleton />}>
      <SearchContent {...props} />
    </Suspense>
  );
}

async function SearchContent({ searchParams }: PageProps<"/search">) {
  const state = parseListingState(await searchParams);

  if (!state.q) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-wide uppercase">Search</h1>
        <p className="text-muted mt-2 text-sm">Search our sarees and suits by name.</p>
        <div className="mt-6">
          <SearchForm defaultValue="" />
        </div>
      </div>
    );
  }

  const [result, facets] = await Promise.all([
    listProducts(toListOptions(state)),
    getFacets({ q: state.q }),
  ]);
  if (result.total > 0 && state.page > result.totalPages) {
    redirect(`/search${listingQuery({ ...state, page: result.totalPages })}`);
  }

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 pt-8">
        <SearchForm defaultValue={state.q} />
      </div>
      <ListingView
        title={`Search results for “${state.q}”`}
        countLabel={`${result.total} ${result.total === 1 ? "result" : "results"}`}
        basePath="/search"
        state={state}
        result={result}
        facets={facets}
        emptyMessage={`No results for “${state.q}”. Try a different word, like “cotton” or “saree”.`}
      />
    </>
  );
}
