import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getDb } from "@/lib/db";
import { absoluteUrl } from "@/lib/seo/site-url";

/** Pages that exist regardless of the catalog. Add About, Contact and policy pages here when they exist. */
const STATIC_PATHS = ["/", "/collections/all"];

/**
 * Every public page, so search engines can find all products and collections.
 * Private pages (cart, checkout, account, orders, search) are deliberately left out.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection(); // read live data on request; never at build time

  const entries: MetadataRoute.Sitemap = STATIC_PATHS.map((p) => ({ url: absoluteUrl(p) }));
  try {
    const db = getDb();
    const [collections, products] = await Promise.all([
      db.collection.findMany({ select: { handle: true }, orderBy: { position: "asc" } }),
      db.product.findMany({
        where: { published: true },
        select: { handle: true, updatedAt: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    for (const c of collections)
      entries.push({ url: absoluteUrl(`/collections/${encodeURIComponent(c.handle)}`) });
    for (const p of products) {
      entries.push({
        url: absoluteUrl(`/products/${encodeURIComponent(p.handle)}`),
        lastModified: p.updatedAt,
      });
    }
  } catch (err) {
    // A partial sitemap is better than an error page: the fixed pages still go out.
    console.error("Sitemap could not read the catalog", err);
  }
  return entries;
}
