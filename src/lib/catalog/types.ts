export const PRODUCT_SORTS = [
  "featured",
  "title-asc",
  "title-desc",
  "price-asc",
  "price-desc",
  "date-desc",
  "date-asc",
] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export const AVAILABILITY_VALUES = ["in-stock", "out-of-stock"] as const;
export type Availability = (typeof AVAILABILITY_VALUES)[number];

/** Counts and price bounds for the filter UI, scoped to a collection and/or search term. */
export type Facets = { inStock: number; outOfStock: number; maxPricePaise: number };

export type ProductSummary = {
  handle: string;
  title: string;
  pricePaise: number;
  compareAtPricePaise: number | null;
  discountPercent: number;
  inStock: boolean;
  imageUrl: string;
  imageAlt: string;
};

export type ProductDetail = ProductSummary & {
  description: string;
  tags: string[];
  images: { url: string; alt: string }[];
  variants: {
    id: string;
    title: string;
    sku: string | null;
    pricePaise: number;
    compareAtPricePaise: number | null;
    inStock: boolean;
  }[];
  collections: { handle: string; title: string }[];
};

export type CollectionSummary = { handle: string; title: string; productCount: number };

export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
