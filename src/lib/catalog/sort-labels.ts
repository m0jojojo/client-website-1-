import type { ProductSort } from "./types";

export const SORT_LABELS: Record<ProductSort, string> = {
  featured: "Featured",
  "title-asc": "Alphabetically, A-Z",
  "title-desc": "Alphabetically, Z-A",
  "price-asc": "Price, low to high",
  "price-desc": "Price, high to low",
  "date-asc": "Date, old to new",
  "date-desc": "Date, new to old",
};
