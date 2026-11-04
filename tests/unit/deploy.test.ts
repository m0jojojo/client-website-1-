import { assertSafeToSeed } from "../../prisma/seed/guard";
import { describeDatabaseUrl } from "../../scripts/lib/db-url";
import { siteRobotsMetadata } from "@/lib/seo/site-url";

const empty = { orders: 0, wishlistItems: 0, cartItems: 0, users: 0 };

describe("assertSafeToSeed", () => {
  it("allows seeding an empty database", () => {
    expect(() => assertSafeToSeed(empty)).not.toThrow();
  });
  it("refuses once customers have data, and says what it found", () => {
    for (const [field, text] of [
      ["orders", "order"],
      ["wishlistItems", "wishlist"],
      ["cartItems", "cart"],
      ["users", "account"],
    ] as const) {
      expect(() => assertSafeToSeed({ ...empty, [field]: 3 })).toThrow(new RegExp(`3 .*${text}`));
    }
    expect(() => assertSafeToSeed({ orders: 2, wishlistItems: 5, cartItems: 0, users: 1 })).toThrow(
      /2 order.*5 saved wishlist.*1 account/,
    );
  });
  it("explains how to proceed on a development database", () => {
    expect(() => assertSafeToSeed({ ...empty, orders: 1 })).toThrow(/FORCE_SEED=true/);
  });
  it("can be overridden deliberately", () => {
    expect(() =>
      assertSafeToSeed({ orders: 9, wishlistItems: 9, cartItems: 9, users: 9 }, true),
    ).not.toThrow();
  });
});

describe("describeDatabaseUrl", () => {
  it("reports host and database without ever exposing the password", () => {
    const d = describeDatabaseUrl(
      "postgresql://neondb_owner:s3cret-pass@ep-cool-name-123-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
    );
    expect(d).toEqual({
      host: "ep-cool-name-123.ap-southeast-1.aws.neon.tech",
      database: "neondb",
      pooled: true,
    });
    expect(JSON.stringify(d)).not.toContain("s3cret");
  });
  it("treats the direct and pooled forms of one database as the same host", () => {
    const a = describeDatabaseUrl("postgresql://u:p@ep-x-1-pooler.region.aws.neon.tech/db");
    const b = describeDatabaseUrl("postgresql://u:p@ep-x-1.region.aws.neon.tech/db");
    expect(a?.host).toBe(b?.host);
    expect(b?.pooled).toBe(false);
  });
  it("rejects anything that is not a Postgres address", () => {
    for (const bad of [
      undefined,
      "",
      "not a url",
      "mysql://u:p@h/db",
      "https://example.com",
      "postgresql://",
    ]) {
      expect(describeDatabaseUrl(bad)).toBeNull();
    }
  });
});

describe("siteRobotsMetadata", () => {
  it("adds nothing on the real production site", () => {
    expect(siteRobotsMetadata({})).toBeUndefined();
    expect(siteRobotsMetadata({ VERCEL_ENV: "production" })).toBeUndefined();
  });
  it("tells search engines to keep out of previews and of a site switched to private", () => {
    expect(siteRobotsMetadata({ VERCEL_ENV: "preview" })).toEqual({ index: false, follow: false });
    expect(siteRobotsMetadata({ NEXT_PUBLIC_ALLOW_INDEXING: "false" })).toEqual({
      index: false,
      follow: false,
    });
    expect(
      siteRobotsMetadata({ VERCEL_ENV: "production", NEXT_PUBLIC_ALLOW_INDEXING: "false" }),
    ).toEqual({ index: false, follow: false });
  });
});
