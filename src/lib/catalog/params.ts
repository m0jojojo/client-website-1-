import { z } from "zod";

export const productListParams = z.object({
  collection: z.string().trim().min(1).max(100).optional(),
  q: z.string().trim().min(1).max(100).optional(),
  sort: z.enum(["newest", "price-asc", "price-desc", "title-asc"]).default("newest"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(24),
});

export function parseProductListParams(searchParams: URLSearchParams) {
  return productListParams.safeParse(Object.fromEntries(searchParams));
}
