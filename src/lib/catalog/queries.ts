import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { discountPercent } from "./pricing";
import type { CollectionSummary, Page, ProductDetail, ProductSort, ProductSummary } from "./types";

export const PLACEHOLDER_IMAGE = "/images/placeholder.svg";

type ProductWithRelations = Prisma.ProductGetPayload<{
  include: { variants: true; images: true };
}>;

/** The variant shown on cards: cheapest in-stock variant, else cheapest overall. */
function primaryVariant(p: ProductWithRelations) {
  const sorted = [...p.variants].sort((a, b) => a.pricePaise - b.pricePaise);
  return sorted.find((v) => v.inStock) ?? sorted[0];
}

function toSummary(p: ProductWithRelations): ProductSummary {
  const v = primaryVariant(p);
  const img = [...p.images].sort((a, b) => a.position - b.position)[0];
  return {
    handle: p.handle,
    title: p.title,
    pricePaise: v?.pricePaise ?? 0,
    compareAtPricePaise: v?.compareAtPricePaise ?? null,
    discountPercent: v ? discountPercent(v.pricePaise, v.compareAtPricePaise) : 0,
    inStock: p.variants.some((x) => x.inStock),
    imageUrl: img?.url ?? PLACEHOLDER_IMAGE,
    imageAlt: img?.alt || p.title,
  };
}

export type ListProductsOptions = {
  collection?: string;
  q?: string;
  sort?: ProductSort;
  page?: number;
  pageSize?: number;
};

export function orderByFor(sort: ProductSort): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "title-asc":
      return [{ title: "asc" }];
    case "newest":
    default:
      return [{ createdAt: "desc" }, { id: "asc" }];
  }
}

export async function listProducts(opts: ListProductsOptions = {}): Promise<Page<ProductSummary>> {
  const { collection, q, sort = "newest", page = 1, pageSize = 24 } = opts;
  const db = getDb();
  const where: Prisma.ProductWhereInput = {
    published: true,
    ...(collection ? { collections: { some: { collection: { handle: collection } } } } : {}),
    ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
  };
  const include = { variants: true, images: true } as const;

  // Price sorting depends on the primary variant, so it is done in memory (catalog is small).
  if (sort === "price-asc" || sort === "price-desc") {
    const all = (await db.product.findMany({ where, include })).map(toSummary);
    all.sort((a, b) =>
      sort === "price-asc" ? a.pricePaise - b.pricePaise : b.pricePaise - a.pricePaise,
    );
    const total = all.length;
    const start = (page - 1) * pageSize;
    return paged(all.slice(start, start + pageSize), total, page, pageSize);
  }

  const [rows, total] = await Promise.all([
    db.product.findMany({
      where,
      include,
      orderBy: orderByFor(sort),
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.product.count({ where }),
  ]);
  return paged(rows.map(toSummary), total, page, pageSize);
}

function paged<T>(items: T[], total: number, page: number, pageSize: number): Page<T> {
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getProductByHandle(handle: string): Promise<ProductDetail | null> {
  const p = await getDb().product.findFirst({
    where: { handle, published: true },
    include: {
      variants: { orderBy: { position: "asc" } },
      images: { orderBy: { position: "asc" } },
      collections: { include: { collection: true } },
    },
  });
  if (!p) return null;
  const summary = toSummary(p);
  return {
    ...summary,
    description: p.description,
    tags: p.tags,
    images: p.images.length
      ? p.images.map((i) => ({ url: i.url, alt: i.alt || p.title }))
      : [{ url: PLACEHOLDER_IMAGE, alt: p.title }],
    variants: p.variants.map((v) => ({
      id: v.id,
      title: v.title,
      sku: v.sku,
      pricePaise: v.pricePaise,
      compareAtPricePaise: v.compareAtPricePaise,
      inStock: v.inStock,
    })),
    collections: p.collections.map((c) => ({
      handle: c.collection.handle,
      title: c.collection.title,
    })),
  };
}

export async function listCollections(): Promise<CollectionSummary[]> {
  const rows = await getDb().collection.findMany({
    orderBy: { position: "asc" },
    include: { _count: { select: { products: true } } },
  });
  return rows.map((c) => ({ handle: c.handle, title: c.title, productCount: c._count.products }));
}

export async function getCollectionByHandle(handle: string) {
  const c = await getDb().collection.findUnique({ where: { handle } });
  return c ? { handle: c.handle, title: c.title } : null;
}
