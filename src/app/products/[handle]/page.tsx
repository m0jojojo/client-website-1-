import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductSectionSkeleton, ProductSectionView } from "@/components/home/ProductSection";
import { Breadcrumbs } from "@/components/product/Breadcrumbs";
import { Description } from "@/components/product/Description";
import { ProductGallery } from "@/components/product/ProductGallery";
import { PurchasePanel } from "@/components/product/PurchasePanel";
import { TrustBadges } from "@/components/product/TrustBadges";
import {
  buildProductJsonLd,
  getProductByHandle,
  getRelatedProducts,
  pickPrimaryCollection,
  serializeJsonLd,
} from "@/lib/catalog";

export async function generateMetadata(props: PageProps<"/products/[handle]">): Promise<Metadata> {
  const { handle } = await props.params;
  const product = await getProductByHandle(handle);
  if (!product) return { title: "Product not found" };
  const description = product.description.replace(/\s+/g, " ").trim().slice(0, 160);
  return {
    title: product.title,
    description: description || undefined,
    openGraph: { title: product.title, description: description || undefined, type: "website" },
  };
}

export default function ProductPage(props: PageProps<"/products/[handle]">) {
  return (
    <Suspense fallback={<ProductSkeleton />}>
      <ProductContent {...props} />
    </Suspense>
  );
}

async function ProductContent({ params }: PageProps<"/products/[handle]">) {
  const { handle } = await params;
  const product = await getProductByHandle(handle);
  if (!product) notFound();

  const collection = pickPrimaryCollection(product.collections);
  const crumbs = [
    { label: "Home", href: "/" },
    ...(collection ? [{ label: collection.title, href: `/collections/${collection.handle}` }] : []),
    { label: product.title },
  ];

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildProductJsonLd(product)) }}
      />
      <Breadcrumbs items={crumbs} />

      <div className="mt-6 grid gap-8 lg:grid-cols-2 lg:gap-12">
        <ProductGallery images={product.images} title={product.title} />
        <div>
          <h1 className="text-2xl font-semibold">{product.title}</h1>
          <div className="mt-4">
            <PurchasePanel title={product.title} variants={product.variants} />
          </div>
          <TrustBadges />
          <Description text={product.description} />
        </div>
      </div>

      <Suspense fallback={<ProductSectionSkeleton />}>
        <RelatedProducts handle={product.handle} />
      </Suspense>
    </main>
  );
}

async function RelatedProducts({ handle }: { handle: string }) {
  const { collection, items } = await getRelatedProducts(handle, 8);
  if (items.length === 0) return null;
  return (
    <div className="border-border mt-10 border-t">
      <ProductSectionView
        title="You may also like"
        viewAllHref={collection ? `/collections/${collection.handle}` : "/collections/all"}
        products={items}
      />
    </div>
  );
}

function ProductSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6" aria-hidden="true">
      <div className="bg-surface h-4 w-64 animate-pulse rounded" />
      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <div className="bg-surface aspect-[4/5] animate-pulse rounded" />
        <div className="space-y-4">
          <div className="bg-surface h-8 w-3/4 animate-pulse rounded" />
          <div className="bg-surface h-8 w-40 animate-pulse rounded" />
          <div className="bg-surface h-12 animate-pulse rounded" />
        </div>
      </div>
    </div>
  );
}
