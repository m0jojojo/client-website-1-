import {
  DESCRIPTION_MAX,
  HOME_SEO,
  TITLE_LIMIT,
  collectionSeo,
  productSeo,
  productSeoName,
  smartTitleCase,
  disambiguate,
  truncate,
  withBrand,
} from "@/lib/seo/copy";

describe("withBrand", () => {
  it("adds the shop name when the title fits", () => {
    expect(withBrand("Cotton Sarees")).toBe("Cotton Sarees | The Block Bagru");
  });
  it("drops the shop name instead of letting the title run past the search-result limit", () => {
    const long = "Geometrical Pattern Printed Cotton Suit With Kota Doriya Dupatta";
    expect(withBrand(long)).toBe(long);
    expect(withBrand("a".repeat(41)).length).toBeLessThanOrEqual(TITLE_LIMIT);
  });
});

describe("truncate", () => {
  it("leaves short text alone and tidies spaces", () => {
    expect(truncate("  hello   world ", 50)).toBe("hello world");
  });
  it("cuts at a word and adds an ellipsis only when cut", () => {
    const out = truncate("The quick brown fox jumps over the lazy dog again and again", 30);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(30);
    expect(out).not.toMatch(/\s…$/);
    expect(
      out
        .slice(0, -1)
        .trim()
        .split(" ")
        .every((w) => "The quick brown fox jumps over the lazy dog again and again".includes(w)),
    ).toBe(true);
  });
  it("never ends on stray punctuation before the ellipsis", () => {
    expect(
      truncate("Soft cotton, breathable, and light on the skin, perfect for summer wear", 40),
    ).not.toMatch(/[,;:\-]…$/);
  });
});

describe("smartTitleCase", () => {
  it("turns ALL CAPS names into Title Case", () => {
    expect(smartTitleCase("YELLOW MOTIFS PRINTED PURE MULCOTTON SAREE")).toBe(
      "Yellow Motifs Printed Pure Mulcotton Saree",
    );
    expect(smartTitleCase("COTTON SUIT WITH KOTA-DORIA DUPATTA (BG24)")).toBe(
      "Cotton Suit With Kota-Doria Dupatta (BG24)",
    );
  });
  it("keeps codes and numbers in capitals", () => {
    expect(smartTitleCase("MAHESHWARI SILK SAREE BGPT 1137")).toBe(
      "Maheshwari Silk Saree BGPT 1137",
    );
    expect(smartTitleCase("NASHPAL DYES MULCOTTON SAREE 1020")).toBe(
      "Nashpal Dyes Mulcotton Saree 1020",
    );
  });
  it("leaves already well-written names exactly as they are", () => {
    for (const t of [
      "Tea print cotton mulmul saree",
      "Maheshwari Silk Saree BGPT 1131",
      "Bagru-Dabu Mulcotton Saree",
      "Floral print Quirky Mulcotton saree BLK",
    ]) {
      expect(smartTitleCase(t)).toBe(t);
    }
  });
  it("copes with odd input", () => {
    expect(smartTitleCase("")).toBe("");
    expect(smartTitleCase("1234")).toBe("1234");
    expect(smartTitleCase("  EXTRA   SPACES  ")).toBe("Extra Spaces");
  });
});

describe("disambiguate (products that share an identical name)", () => {
  const geo = [
    "geometrical-printed-mulcotton-saree",
    "geometrical-printed-mulcotton-saree-1",
    "geometrical-printed-mulcotton-saree-2",
  ];
  const name = "Geometrical Printed Mulcotton Saree";

  it("leaves a product with a unique name exactly as it is", () => {
    expect(disambiguate(name, geo[0])).toBe(name);
    expect(disambiguate(name, geo[0], [geo[0]])).toBe(name);
  });
  it("lets the first address keep the plain name and tags the others from their own address", () => {
    expect(disambiguate(name, geo[0], geo)).toBe(name);
    expect(disambiguate(name, geo[1], geo)).toBe(`${name} (Ref 1)`);
    expect(disambiguate(name, geo[2], geo)).toBe(`${name} (Ref 2)`);
  });
  it("gives every twin a different result, whatever order they are listed in", () => {
    const shuffled = [geo[2], geo[0], geo[1]];
    const results = geo.map((h) => disambiguate(name, h, shuffled));
    expect(new Set(results).size).toBe(3);
  });
  it("uses the code at the end of the address, which is how Shopify-style names get told apart", () => {
    const twins = ["maheshwari-silk-saree-bgpt-1131", "maheshwari-silk-saree-bgpt-1136"];
    expect(disambiguate("Maheshwari Silk Saree BGPT 1131", twins[0], twins)).toBe(
      "Maheshwari Silk Saree BGPT 1131",
    );
    expect(disambiguate("Maheshwari Silk Saree BGPT 1131", twins[1], twins)).toBe(
      "Maheshwari Silk Saree BGPT 1131 (Ref 1136)",
    );
  });
  it("never changes the name itself, so the title always matches the heading on the page", () => {
    const twins = ["nashpal-dyes-mulcotton-saree-1020", "nashpal-dyes-mulcotton-saree-1022"];
    expect(
      disambiguate("Nashpal Dyes Mulcotton Saree 1020", twins[1], twins).startsWith(
        "Nashpal Dyes Mulcotton Saree 1020",
      ),
    ).toBe(true);
  });
  it("falls back to the whole address when two tags would clash", () => {
    const twins = ["a-saree", "b-saree-2", "c-saree-2"];
    const b = disambiguate("Saree", "b-saree-2", twins);
    const c = disambiguate("Saree", "c-saree-2", twins);
    expect(b).not.toBe(c);
  });
  it("is part of the product search name, together with the capitals fix", () => {
    const twins = ["nashpal-dyes-mulcotton-saree-1020", "nashpal-dyes-mulcotton-saree-1022"];
    expect(productSeoName("NASHPAL DYES MULCOTTON SAREE 1020", twins[1], twins)).toBe(
      "Nashpal Dyes Mulcotton Saree 1020 (Ref 1022)",
    );
    expect(
      productSeoName("NASHPAL DYES MULCOTTON SAREE 1022", "nashpal-dyes-mulcotton-saree-1024"),
    ).toBe("Nashpal Dyes Mulcotton Saree 1022");
  });
});

describe("productSeo", () => {
  const base = {
    title: "TEA PRINT COTTON MULMUL SAREE",
    handle: "tea-print-cotton-mulmul-saree",
    pricePaise: 89900,
    description:
      "Product Details\nBeautifully Crafted Cotton Mulmul saree in Tea print Design\n\nQuirky mul mul cotton sarees are a delightful fusion of traditional elegance and modern charm.",
  };
  it("writes a title, with the shop name when it fits", () => {
    expect(productSeo(base).title).toBe("Tea Print Cotton Mulmul Saree | The Block Bagru");
  });
  it("opens with the name and price, skips the 'Product Details' heading, and stays within the limit", () => {
    const d = productSeo(base).description;
    expect(d.startsWith("Buy Tea Print Cotton Mulmul Saree online for ₹899.")).toBe(true);
    expect(d).not.toMatch(/Product Details/i);
    expect(d.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    expect(d.length).toBeGreaterThan(70);
  });
  it("uses the twin tag in both the title and the description", () => {
    const twins = ["geo-saree", "geo-saree-2"];
    const a = productSeo({ ...base, title: "Geo Saree", handle: "geo-saree", twinHandles: twins });
    const b = productSeo({
      ...base,
      title: "Geo Saree",
      handle: "geo-saree-2",
      twinHandles: twins,
    });
    expect(a.title).not.toBe(b.title);
    expect(a.description).not.toBe(b.description);
    expect(b.description).toContain("(Ref 2)");
  });
  it("gives products with identical descriptions different search descriptions", () => {
    const shared = { description: base.description, pricePaise: 89900 };
    const a = productSeo({ ...shared, title: "Floral Saree", handle: "floral-saree" });
    const b = productSeo({ ...shared, title: "Dotted Saree", handle: "dotted-saree" });
    expect(a.description).not.toBe(b.description);
    expect(a.title).not.toBe(b.title);
  });
  it("handles a missing description", () => {
    const s = productSeo({ ...base, description: "" });
    expect(s.description).toContain("Buy Tea Print Cotton Mulmul Saree online for ₹899.");
    expect(s.description).toContain("Free shipping");
  });
  it("shows paise when the price has them", () => {
    expect(productSeo({ ...base, pricePaise: 129950 }).description).toContain("₹1,299.50");
  });
  it("keeps very long names and long descriptions within bounds", () => {
    const s = productSeo({ ...base, title: "x ".repeat(60), description: "word ".repeat(500) });
    expect(s.description.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    expect(s.description.endsWith("…")).toBe(true);
  });
});

describe("collectionSeo", () => {
  it("writes buying-intent titles and counts the products", () => {
    const c = collectionSeo({ handle: "cotton-sarees", title: "Cotton Sarees", productCount: 67 });
    expect(c.title).toBe("Buy Cotton Sarees Online | The Block Bagru");
    expect(c.description).toContain("67 cotton sarees");
    expect(c.description).toContain("Free shipping");
    expect(c.description.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
  });
  it("has its own wording for the all-products and new-arrivals pages", () => {
    expect(
      collectionSeo({ handle: "all", title: "All Products", productCount: 201 }).title,
    ).toContain("All Hand Block Printed Sarees & Suits");
    expect(
      collectionSeo({ handle: "new-arrivals", title: "New Arrivals", productCount: 134 }).title,
    ).toContain("New Arrivals");
  });
  it("marks later pages so each page has its own title and description", () => {
    const p1 = collectionSeo({ handle: "cotton-sarees", title: "Cotton Sarees", productCount: 67 });
    const p2 = collectionSeo({
      handle: "cotton-sarees",
      title: "Cotton Sarees",
      productCount: 67,
      page: 2,
    });
    expect(p2.title).toContain("Page 2");
    expect(p2.title).not.toBe(p1.title);
    expect(p2.description).not.toBe(p1.description);
    expect(
      collectionSeo({ handle: "cotton-sarees", title: "Cotton Sarees", productCount: 67, page: 1 })
        .title,
    ).toBe(p1.title);
  });
  it("copes with a single product and ALL CAPS collection names", () => {
    expect(
      collectionSeo({ handle: "x", title: "NASHPAL DYES MUL COTTON SAREES", productCount: 1 })
        .title,
    ).toContain("Nashpal Dyes Mul Cotton Sarees");
  });
});

describe("home page text", () => {
  it("has a title and description of sensible length", () => {
    expect(HOME_SEO.title.length).toBeLessThanOrEqual(TITLE_LIMIT);
    expect(HOME_SEO.title).toContain("The Block Bagru");
    expect(HOME_SEO.description.length).toBeGreaterThan(80);
    expect(HOME_SEO.description.length).toBeLessThanOrEqual(DESCRIPTION_MAX + 2);
  });
});
