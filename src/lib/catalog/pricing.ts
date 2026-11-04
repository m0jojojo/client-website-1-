/** Whole-percent discount between compare-at and sale price, or 0 when not on sale. */
export function discountPercent(pricePaise: number, compareAtPricePaise: number | null): number {
  if (!compareAtPricePaise || compareAtPricePaise <= pricePaise) return 0;
  return Math.round(((compareAtPricePaise - pricePaise) / compareAtPricePaise) * 100);
}

/** Format paise as Indian rupees, e.g. 289900 -> "₹2,899". */
export function formatRupees(paise: number): string {
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString("en-IN", {
    minimumFractionDigits: Number.isInteger(rupees) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}
