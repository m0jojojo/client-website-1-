/** Safe-to-print facts about a Postgres connection string: never the user or password. */
export function describeDatabaseUrl(
  url: string | undefined,
): { host: string; database: string; pooled: boolean } | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "postgresql:" && u.protocol !== "postgres:") return null;
    if (!u.hostname) return null;
    // Neon marks pooled connections with "-pooler" in the host. The same database has a direct host without it.
    const host = u.hostname.replace("-pooler", "");
    return {
      host,
      database: u.pathname.replace(/^\//, ""),
      pooled: u.hostname.includes("-pooler"),
    };
  } catch {
    return null;
  }
}
