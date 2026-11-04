import type { ProductDetail } from "./types";

/** schema.org Product markup for search engines. */
export function buildProductJsonLd(p: ProductDetail) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.title,
    description: p.description.slice(0, 500),
    sku: p.variants[0]?.sku ?? undefined,
    brand: { "@type": "Brand", name: "The Block Bagru" },
    offers: {
      "@type": "Offer",
      priceCurrency: "INR",
      price: (p.pricePaise / 100).toFixed(2),
      availability: p.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };
}

/** Safe to embed inside a <script> tag: "<" is escaped so the data can never close the tag. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
