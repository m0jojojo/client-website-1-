import { config } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

config({ path: ".env.local", quiet: true });

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: "http://localhost:3000", trace: "on-first-retry" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    env: {
      // Placeholder Google credentials are enough to render the sign-in button and build the
      // redirect URL; real Google sign-in cannot be automated.
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? "e2e-placeholder-client-id",
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? "e2e-placeholder-client-secret",
      BETTER_AUTH_URL: "http://localhost:3000",
      // Parallel test workers all share one IP and sign in often; see src/lib/auth-rate-limit.ts.
      AUTH_RATE_LIMIT_DISABLED: "true",
      // Payments run against the local stand-in, never real Razorpay, whatever is in .env.local.
      PAYMENTS_MOCK: "true",
      RAZORPAY_KEY_ID: "",
      RAZORPAY_KEY_SECRET: "",
      RAZORPAY_WEBHOOK_SECRET: "e2e-webhook-secret",
    },
    timeout: 180_000,
  },
});
