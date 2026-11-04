import Image from "next/image";
import Link from "next/link";
import { WishlistButton } from "@/components/wishlist/WishlistButton";
import { formatRupees } from "@/lib/catalog/pricing";
import type { ProductSummary } from "@/lib/catalog/types";

export function ProductCard({ product }: { product: ProductSummary }) {
  const onSale = product.discountPercent > 0 && product.compareAtPricePaise;
  return (
    <article className="group relative flex flex-col">
      <Link href={`/products/${product.handle}`} className="block">
        <div className="bg-surface relative aspect-[4/5] overflow-hidden rounded-sm">
          <Image
            src={product.imageUrl}
            alt={product.imageAlt}
            fill
            sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
            unoptimized={product.imageUrl.endsWith(".svg")}
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
          {!product.inStock && (
            <span className="bg-foreground text-background absolute top-2 left-2 rounded-sm px-2 py-1 text-xs font-semibold">
              Sold out
            </span>
          )}
          {product.inStock && onSale && (
            <span className="bg-accent text-accent-foreground absolute top-2 left-2 rounded-sm px-2 py-1 text-xs font-semibold">
              {product.discountPercent}% OFF
            </span>
          )}
        </div>
        <h3 className="mt-3 line-clamp-2 text-sm font-medium">{product.title}</h3>
      </Link>
      <WishlistButton
        handle={product.handle}
        title={product.title}
        className="absolute top-2 right-2"
      />
      <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className="font-semibold">{formatRupees(product.pricePaise)}</span>
        {onSale && (
          <s
            className="text-muted"
            aria-label={`Regular price ${formatRupees(product.compareAtPricePaise!)}`}
          >
            {formatRupees(product.compareAtPricePaise!)}
          </s>
        )}
      </p>
    </article>
  );
}
