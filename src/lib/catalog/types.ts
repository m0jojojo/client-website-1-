export type ProductSort = "newest" | "price-asc" | "price-desc" | "title-asc";

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
