import type { MetadataRoute } from "next";
import { absoluteUrl, isIndexableEnvironment } from "@/lib/seo/site-url";

/** Private or useless-to-search pages that crawlers should not visit. */
export const DISALLOWED_PATHS = [
  "/api/",
  "/cart",
  "/checkout",
  "/account",
  "/orders",
  "/wishlist",
  "/search",
];

export default function robots(): MetadataRoute.Robots {
  // Preview and test deployments must never appear in Google.
  if (!isIndexableEnvironment()) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: DISALLOWED_PATHS },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
