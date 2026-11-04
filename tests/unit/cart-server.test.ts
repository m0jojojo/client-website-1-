import { generateCartToken, hashCartToken, isPlausibleToken } from "@/lib/cart/token";
import { isSameOrigin } from "@/lib/cart/http";
import { parseProductListParams, paramsToOptions } from "@/lib/catalog/params";
import { buildWhere } from "@/lib/catalog/queries";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

describe("cart tokens", () => {
  it("generates unguessable, unique, URL-safe tokens that pass validation", () => {
    const a = generateCartToken();
    const b = generateCartToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(isPlausibleToken(a)).toBe(true);
  });
  it("rejects malformed tokens", () => {
    for (const t of [
      undefined,
      "",
      "short",
      "x".repeat(44),
      "has space " + "a".repeat(33),
      "../etc/passwd",
    ]) {
      expect(isPlausibleToken(t)).toBe(false);
    }
  });
  it("stores only a stable hash that differs from the token", () => {
    const t = generateCartToken();
    expect(hashCartToken(t)).toBe(hashCartToken(t));
    expect(hashCartToken(t)).not.toContain(t);
    expect(hashCartToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashCartToken(t)).not.toBe(hashCartToken(generateCartToken()));
  });
});

describe("isSameOrigin", () => {
  const req = (origin: string | null) =>
    new Request("http://localhost:3000/api/cart/items", {
      method: "POST",
      headers: { host: "localhost:3000", ...(origin ? { origin } : {}) },
    });
  it("allows requests without an Origin header and from the same host", () => {
    expect(isSameOrigin(req(null))).toBe(true);
    expect(isSameOrigin(req("http://localhost:3000"))).toBe(true);
  });
  it("blocks other origins and garbage", () => {
    expect(isSameOrigin(req("https://evil.example"))).toBe(false);
    expect(isSameOrigin(req("http://localhost:3001"))).toBe(false);
    expect(isSameOrigin(req("not a url"))).toBe(false);
  });
});

describe("handles filter", () => {
  it("parses a comma list, trims, drops blanks and caps at 60", () => {
    const many = Array.from({ length: 80 }, (_, i) => `p${i}`).join(",");
    const r = parseProductListParams(new URLSearchParams({ handles: ` a , b,,c,${many}` }));
    expect(r.success && r.data.handles?.slice(0, 3)).toEqual(["a", "b", "c"]);
    expect(r.success && r.data.handles).toHaveLength(60);
  });
  it("passes through to the data layer and the query", () => {
    const r = parseProductListParams(new URLSearchParams({ handles: "a,b" }));
    const opts = r.success && paramsToOptions(r.data);
    expect(opts && opts.handles).toEqual(["a", "b"]);
    expect(buildWhere({ handles: ["a", "b"] }).handle).toEqual({ in: ["a", "b"] });
    expect(buildWhere({}).handle).toBeUndefined();
  });
});
