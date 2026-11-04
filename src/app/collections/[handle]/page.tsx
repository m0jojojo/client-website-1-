import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ListingSkeleton, ListingView } from "@/components/listing/ListingView";
import { getCollectionByHandle, getFacets, listProducts, listingQuery } from "@/lib/catalog";
import { parseListingState, toListOptions } from "@/lib/catalog/params";
import { collectionSeo } from "@/lib/seo/listing-seo";

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
  const seo = collectionSeo(`/collections/${handle}`, parseListingState(await props.searchParams));
  return {
    title: collection.title,
    alternates: { canonical: seo.canonicalPath },
    ...(seo.noindex ? { robots: { index: false, follow: true } } : {}),
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
