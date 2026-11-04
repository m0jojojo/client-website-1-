/**
 * How payments are wired up:
 *  - "live": real Razorpay, when RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are set (use test-mode keys
 *    while developing; they start with rzp_test_).
 *  - "mock": a stand-in for local development and automated tests only. It needs PAYMENTS_MOCK=true
 *    AND a localhost site URL, so it can never switch on for a real website.
 *  - "unconfigured": neither, so online payment is unavailable (cash on delivery still works).
 */
export type PaymentsConfig =
  | { mode: "live"; keyId: string; keySecret: string }
  | { mode: "mock"; keyId: string; keySecret: string }
  | { mode: "unconfigured" };

/** Only used by the mock mode. It protects nothing real. */
export const MOCK_KEY_ID = "rzp_test_mock";
export const MOCK_KEY_SECRET = "mock-razorpay-secret-for-local-testing-only";

type Env = Record<string, string | undefined>;

export function isLocalSiteUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "[::1]" ||
      host.endsWith(".localhost")
    );
  } catch {
    return false;
  }
}

export function getPaymentsConfig(env: Env = process.env): PaymentsConfig {
  const keyId = env.RAZORPAY_KEY_ID?.trim();
  const keySecret = env.RAZORPAY_KEY_SECRET?.trim();
  if (keyId && keySecret) return { mode: "live", keyId, keySecret };
  if (
    env.PAYMENTS_MOCK === "true" &&
    isLocalSiteUrl(env.BETTER_AUTH_URL ?? env.NEXT_PUBLIC_APP_URL)
  ) {
    return { mode: "mock", keyId: MOCK_KEY_ID, keySecret: MOCK_KEY_SECRET };
  }
  return { mode: "unconfigured" };
}

export const onlinePaymentAvailable = (env: Env = process.env) =>
  getPaymentsConfig(env).mode !== "unconfigured";
