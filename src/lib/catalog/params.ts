import { z } from "zod";
import { AVAILABILITY_VALUES, PRODUCT_SORTS, type Availability, type ProductSort } from "./types";

const rupees = z.coerce.number().int().min(0).max(10_000_000);

export const productListParams = z.object({
  collection: z.string().trim().min(1).max(100).optional(),
  q: z.string().trim().min(1).max(100).optional(),
  sort: z.enum(PRODUCT_SORTS).default("featured"),
  availability: z.array(z.enum(AVAILABILITY_VALUES)).default([]),
  minPrice: rupees.optional(),
  maxPrice: rupees.optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(24),
});

type Raw = Record<string, string | string[] | undefined>;

function normalize(raw: Raw) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v === undefined) continue;
    const first = Array.isArray(v) ? v[0] : v;
    // Blank form fields (e.g. an empty price box) mean "not set", not an error.
    if (k === "availability") out[k] = (Array.isArray(v) ? v : [v]).filter((x) => x !== "");
    else if (first !== "") out[k] = first;
  }
  return out;
}

export function toRaw(searchParams: URLSearchParams): Raw {
  const raw: Raw = {};
  for (const key of new Set(searchParams.keys())) {
    const all = searchParams.getAll(key);
    raw[key] = key === "availability" ? all : all[0];
  }
  return raw;
}

/** Strict parsing for the JSON API: bad input is an error. */
export function parseProductListParams(searchParams: URLSearchParams) {
  return productListParams.safeParse(normalize(toRaw(searchParams)));
}

export type ListingState = {
  q?: string;
  sort: ProductSort;
  availability: Availability[];
  minPrice?: number;
  maxPrice?: number;
  page: number;
};

/** Lenient parsing for pages: bad or missing values fall back to defaults instead of erroring. */
export function parseListingState(raw: Raw): ListingState {
  const n = normalize(raw);
  const field = <T extends z.ZodType>(schema: T, key: string): z.infer<T> | undefined => {
    const r = schema.safeParse(n[key]);
    return r.success ? r.data : undefined;
  };
  let minPrice = field(rupees, "minPrice");
  let maxPrice = field(rupees, "maxPrice");
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }
  const availability = (Array.isArray(n.availability) ? n.availability : []).filter(
    (v): v is Availability => (AVAILABILITY_VALUES as readonly string[]).includes(v as string),
  );
  return {
    q: field(z.string().trim().min(1).max(100), "q"),
    sort: field(z.enum(PRODUCT_SORTS), "sort") ?? "featured",
    availability: [...new Set(availability)],
    minPrice,
    maxPrice,
    page: field(z.coerce.number().int().min(1).max(10_000), "page") ?? 1,
  };
}

/** Builds a query string from listing state; omits defaults so URLs stay clean. */
export function listingQuery(state: Partial<ListingState>): string {
  const p = new URLSearchParams();
  if (state.q) p.set("q", state.q);
  if (state.sort && state.sort !== "featured") p.set("sort", state.sort);
  for (const a of state.availability ?? []) p.append("availability", a);
  if (state.minPrice !== undefined) p.set("minPrice", String(state.minPrice));
  if (state.maxPrice !== undefined) p.set("maxPrice", String(state.maxPrice));
  if (state.page && state.page > 1) p.set("page", String(state.page));
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Convert validated API params (rupees) into data-layer options (paise). */
export function paramsToOptions(p: z.infer<typeof productListParams>) {
  return {
    collection: p.collection,
    q: p.q,
    sort: p.sort,
    availability: p.availability,
    minPricePaise: p.minPrice !== undefined ? p.minPrice * 100 : undefined,
    maxPricePaise: p.maxPrice !== undefined ? p.maxPrice * 100 : undefined,
    page: p.page,
    pageSize: p.pageSize,
  };
}

/** Convert page-level listing state into data-layer options (rupees -> paise). */
export function toListOptions(
  state: ListingState,
  extra: { collection?: string; pageSize?: number } = {},
) {
  return {
    q: state.q,
    sort: state.sort,
    availability: state.availability,
    minPricePaise: state.minPrice !== undefined ? state.minPrice * 100 : undefined,
    maxPricePaise: state.maxPrice !== undefined ? state.maxPrice * 100 : undefined,
    page: state.page,
    pageSize: extra.pageSize ?? 24,
    collection: extra.collection,
  };
}
