type Env = Record<string, string | undefined>;

const FALLBACK = "http://localhost:3000";

function toOrigin(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

/**
 * The public address of the site (no trailing slash), used for canonical links, the sitemap and
 * share previews. Set NEXT_PUBLIC_SITE_URL to the real domain (e.g. https://theblockbagru.com).
 * Falls back to Vercel's production address, then the sign-in URL, then localhost.
 */
export function getSiteUrl(env: Env = process.env): string {
  return (
    toOrigin(env.NEXT_PUBLIC_SITE_URL) ??
    toOrigin(
      env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
        : undefined,
    ) ??
    toOrigin(env.BETTER_AUTH_URL) ??
    FALLBACK
  );
}

export function absoluteUrl(path: string, env: Env = process.env): string {
  return new URL(path, getSiteUrl(env)).toString();
}

/**
 * Search engines should only index the real production site. Vercel preview and development
 * deployments, or anything with NEXT_PUBLIC_ALLOW_INDEXING=false, are kept out of search results.
 */
export function isIndexableEnvironment(env: Env = process.env): boolean {
  if (env.NEXT_PUBLIC_ALLOW_INDEXING === "false") return false;
  if (env.VERCEL_ENV && env.VERCEL_ENV !== "production") return false;
  return true;
}
