import { authRateLimitConfig } from "@/lib/auth-rate-limit";

describe("authRateLimitConfig", () => {
  it("keeps the limiter on by default and exempts only session checks", () => {
    const c = authRateLimitConfig({});
    expect(c).not.toHaveProperty("enabled");
    expect(c.customRules).toEqual({ "/get-session": false });
  });
  it("can be switched off only with the exact test flag", () => {
    expect(authRateLimitConfig({ AUTH_RATE_LIMIT_DISABLED: "true" })).toMatchObject({
      enabled: false,
    });
    for (const v of ["false", "1", "TRUE", "", undefined]) {
      expect(authRateLimitConfig({ AUTH_RATE_LIMIT_DISABLED: v })).not.toHaveProperty("enabled");
    }
  });
});
