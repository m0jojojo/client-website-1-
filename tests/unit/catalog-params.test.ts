import { parseProductListParams } from "@/lib/catalog/params";

const parse = (qs: string) => parseProductListParams(new URLSearchParams(qs));

describe("parseProductListParams", () => {
  it("applies defaults", () => {
    const r = parse("");
    expect(r.success && r.data).toMatchObject({ sort: "newest", page: 1, pageSize: 24 });
  });
  it("coerces numbers and accepts known sorts", () => {
    const r = parse("page=2&pageSize=12&sort=price-asc&collection=cotton-sarees&q=blue");
    expect(r.success && r.data).toEqual({
      page: 2,
      pageSize: 12,
      sort: "price-asc",
      collection: "cotton-sarees",
      q: "blue",
    });
  });
  it.each(["page=0", "page=abc", "pageSize=1000", "sort=random"])("rejects %s", (qs) => {
    expect(parse(qs).success).toBe(false);
  });
});
