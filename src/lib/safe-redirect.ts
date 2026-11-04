/**
 * Only allow redirects to paths on this site. Anything else (other domains, protocol-relative
 * "//evil.com", backslash tricks, javascript: URLs) falls back to the default.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/account"): string {
  if (!next || typeof next !== "string") return fallback;
  if (next.length > 300) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  if (/[\\\u0000-\u001f]/.test(next)) return fallback;
  try {
    const u = new URL(next, "http://site.invalid");
    if (u.origin !== "http://site.invalid") return fallback;
    return u.pathname + u.search + u.hash;
  } catch {
    return fallback;
  }
}
