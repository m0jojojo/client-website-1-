/**
 * Rate limiting for /api/auth. Better Auth's defaults stay in force (sign-in endpoints allow only
 * 3 requests per 10 seconds per IP) with one exception: session checks are not limited. They run on
 * every page view, are cheap, and many mobile customers share a single public IP address, so a
 * shared limit could make signed-in customers look signed out.
 *
 * AUTH_RATE_LIMIT_DISABLED=true switches the limiter off entirely. It exists only for the automated
 * browser tests, which sign in from many parallel workers on one IP. Never set it in production.
 */
export function authRateLimitConfig(env: Record<string, string | undefined> = process.env) {
  return {
    ...(env.AUTH_RATE_LIMIT_DISABLED === "true" ? { enabled: false } : {}),
    customRules: { "/get-session": false as const },
  };
}
