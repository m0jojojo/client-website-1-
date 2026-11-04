import { discountPercent, formatRupees } from "@/lib/catalog/pricing";

describe("discountPercent", () => {
  it("rounds to whole percent", () => {
    expect(discountPercent(289900, 489900)).toBe(41);
    expect(discountPercent(129900, 269900)).toBe(52);
  });
  it("is 0 when not on sale or compare-at is missing/lower", () => {
    expect(discountPercent(100, null)).toBe(0);
    expect(discountPercent(100, 100)).toBe(0);
    expect(discountPercent(200, 100)).toBe(0);
  });
});

describe("formatRupees", () => {
  it("formats paise as Indian rupees with grouping", () => {
    expect(formatRupees(289900)).toBe("₹2,899");
    expect(formatRupees(10000000)).toBe("₹1,00,000");
  });
  it("shows paise only when needed", () => {
    expect(formatRupees(129950)).toBe("₹1,299.50");
  });
});
