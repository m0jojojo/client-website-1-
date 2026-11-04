import type { ListingState } from "@/lib/catalog/params";

export type ListingSeo = {
  /** Path (not full URL) Google should treat as the one true address of this page. */
  canonicalPath: string;
  /** True for sorted or filtered variants, which would otherwise duplicate the main list. */
  noindex: boolean;
};

/**
 * Collection pages can be reached with many address variants. Rules:
 *  - sorted or filtered views point to the plain collection page and are kept out of the index
 *  - page 2, 3, ... are real, separate pages: each points to itself and may be indexed
 *  - page 1 and "?page=1" both point to the plain collection address
 */
export function collectionSeo(basePath: string, state: ListingState): ListingSeo {
  const filtered =
    state.sort !== "featured" ||
    state.availability.length > 0 ||
    state.minPrice !== undefined ||
    state.maxPrice !== undefined;
  if (filtered) return { canonicalPath: basePath, noindex: true };
  return {
    canonicalPath: state.page > 1 ? `${basePath}?page=${state.page}` : basePath,
    noindex: false,
  };
}
