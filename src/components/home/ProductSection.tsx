import Link from "next/link";
import { connection } from "next/server";
import { ProductCard } from "@/components/catalog/ProductCard";
import { Carousel, CarouselItem } from "@/components/ui/Carousel";
import { listProducts, type ProductSummary } from "@/lib/catalog";

export function ProductSectionView({
  title,
  viewAllHref,
  products,
}: {
  title: string;
  viewAllHref: string;
  products: ProductSummary[];
}) {
  return (
    <section aria-labelledby={`sec-${slug(title)}`} className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 id={`sec-${slug(title)}`} className="text-xl font-semibold tracking-wide uppercase">
          {title}
        </h2>
        <Link href={viewAllHref} className="text-sm font-medium underline-offset-4 hover:underline">
          View all &rsaquo;
        </Link>
      </div>
      <Carousel label={`${title} products`}>
        {products.map((p) => (
          <CarouselItem key={p.handle}>
            <ProductCard product={p} />
          </CarouselItem>
        ))}
      </Carousel>
    </section>
  );
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

/** Loads products at request time. Renders nothing if the catalog is unavailable or empty. */
export async function ProductSection(props: {
  title: string;
  viewAllHref: string;
  collection?: string;
  limit?: number;
}) {
  await connection(); // never bake a DB-less (empty) result into the static shell
  let products: ProductSummary[] = [];
  try {
    products = (await listProducts({ collection: props.collection, pageSize: props.limit ?? 10 }))
      .items;
  } catch (err) {
    console.error(`ProductSection "${props.title}" failed to load`, err);
  }
  if (products.length === 0) return null;
  return (
    <ProductSectionView title={props.title} viewAllHref={props.viewAllHref} products={products} />
  );
}

export function ProductSectionSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8" aria-hidden="true">
      <div className="bg-surface mb-4 h-6 w-48 animate-pulse rounded" />
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="bg-surface aspect-[4/5] w-[46%] shrink-0 animate-pulse rounded sm:w-[31%] lg:w-[22%]"
          />
        ))}
      </div>
    </div>
  );
}
