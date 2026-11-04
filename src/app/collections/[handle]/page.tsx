import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ListingSkeleton, ListingView } from "@/components/listing/ListingView";
import { getCollectionByHandle, getFacets, listProducts, listingQuery } from "@/lib/catalog";
import { parseListingState, toListOptions } from "@/lib/catalog/params";
import { collectionSeo as listingSeo } from "@/lib/seo/listing-seo";
import { collectionSeo as collectionCopy } from "@/lib/seo/copy";

const ALL = "all";

async function resolveCollection(handle: string) {
  if (handle === ALL) return { handle: ALL, title: "All Products" };
  return getCollectionByHandle(handle);
}

export async function generateMetadata(
  props: PageProps<"/collections/[handle]">,
): Promise<Metadata> {
  const { handle } = await props.params;
  const collection = await resolveCollection(handle);
  if (!collection) return { title: "Collection not found", robots: { index: false, follow: true } };
  const state = parseListingState(await props.searchParams);
  const seo = listingSeo(`/collections/${handle}`, state);
  const facets = await getFacets({ collection: handle === ALL ? undefined : handle });
  const productCount = facets.inStock + facets.outOfStock;
  const copy = collectionCopy({ handle, title: collection.title, productCount, page: state.page });
  // An empty collection has nothing to show, so it should not appear in search results.
  const noindex = seo.noindex || productCount === 0;
  return {
    title: { absolute: copy.title },
    description: copy.description,
    alternates: { canonical: seo.canonicalPath },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

export default function CollectionPage(props: PageProps<"/collections/[handle]">) {
  return (
    <Suspense fallback={<ListingSkeleton />}>
      <CollectionContent {...props} />
    </Suspense>
  );
}

async function CollectionContent({ params, searchParams }: PageProps<"/collections/[handle]">) {
  const { handle } = await params;
  const state = parseListingState(await searchParams);
  const collection = await resolveCollection(handle);
  if (!collection) notFound();

  const scope = handle === ALL ? undefined : handle;
  const [result, facets] = await Promise.all([
    listProducts(toListOptions(state, { collection: scope })),
    getFacets({ collection: scope }),
  ]);

  const basePath = `/collections/${handle}`;
  if (result.total > 0 && state.page > result.totalPages) {
    redirect(`${basePath}${listingQuery({ ...state, page: result.totalPages })}`);
  }

  return (
    <ListingView
      title={collection.title}
      countLabel={`${result.total} ${result.total === 1 ? "product" : "products"}`}
      basePath={basePath}
      state={state}
      result={result}
      facets={facets}
    />
  );
}
