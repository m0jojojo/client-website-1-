import { formatRupees } from "@/lib/catalog/pricing";

export const BRAND = "The Block Bagru";
/** Search results show roughly the first 60 characters of a page title. */
export const TITLE_LIMIT = 60;
export const DESCRIPTION_MAX = 158;

export function withBrand(title: string): string {
  const full = `${title} | ${BRAND}`;
  return full.length <= TITLE_LIMIT ? full : title;
}

/** Cuts text at a word boundary and adds an ellipsis only when something was cut. */
export function truncate(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.\-–—(]+$/, "")}…`;
}

// Short product-code prefixes that should stay in capitals.
const KEEP_UPPER = new Set(["BG", "BGPT", "BGCB", "MCTN", "II", "III"]);

function capitalizeWord(word: string): string {
  const m = /^([^A-Za-z0-9]*)(.*?)([^A-Za-z0-9]*)$/.exec(word);
  if (!m || !m[2]) return word;
  const [, lead, core, trail] = m;
  if (/\d/.test(core) || KEEP_UPPER.has(core.toUpperCase()))
    return lead + core.toUpperCase() + trail;
  return lead + core[0].toUpperCase() + core.slice(1).toLowerCase() + trail;
}

/**
 * Many product names are entered in ALL CAPS, which reads as shouting in search results. Names that
 * are mostly capitals become Title Case (codes like "BG30" and "BGPT" stay as they are); names that
 * are already in normal mixed case are left exactly as written.
 */
export function smartTitleCase(title: string): string {
  const t = title.replace(/\s+/g, " ").trim();
  const letters = t.replace(/[^A-Za-z]/g, "");
  if (!letters) return t;
  const upperShare = letters.replace(/[^A-Z]/g, "").length / letters.length;
  if (upperShare < 0.7) return t;
  return t
    .split(" ")
    .map((w) => w.split("-").map(capitalizeWord).join("-"))
    .join(" ");
}

/**
 * Products that share an identical name would get identical search-result titles. One of them (the
 * one whose address sorts first) keeps the plain name; each of the others gets a short "(Ref …)" tag
 * taken from its own address, e.g. "Geometrical Printed Mulcotton Saree (Ref 2)". Names are never
 * changed otherwise, so the search title always matches the heading on the page.
 */
export function disambiguate(name: string, handle: string, twinHandles: string[] = []): string {
  if (twinHandles.length < 2) return name;
  const sorted = [...twinHandles].sort();
  if (sorted[0] === handle) return name;
  const refOf = (h: string) => /-(\d{1,6})$/.exec(h)?.[1] ?? h;
  const others = sorted.slice(1);
  const clash = others.filter((h) => refOf(h) === refOf(handle)).length > 1;
  return `${name} (Ref ${clash ? handle : refOf(handle)})`;
}

export function productSeoName(title: string, handle: string, twinHandles: string[] = []): string {
  return disambiguate(smartTitleCase(title), handle, twinHandles);
}

/** First useful words of the product's own description, without headings like "Product Details". */
function descriptionSnippet(description: string): string {
  const cleaned = description
    .replace(/^\s*product details\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const firstSentence = /^(.{40,}?[.!?])(\s|$)/.exec(cleaned)?.[1] ?? cleaned;
  return firstSentence;
}

export type SeoText = { title: string; description: string };

const SHIPPING_TAIL = "Free shipping across India, COD available.";

export function productSeo(p: {
  title: string;
  handle: string;
  pricePaise: number;
  description: string;
  /** Handles of every published product with this same stored name (including this one). */
  twinHandles?: string[];
}): SeoText {
  const name = productSeoName(p.title, p.handle, p.twinHandles);
  const lead = `Buy ${name} online for ${formatRupees(p.pricePaise)}.`;
  const snippet = descriptionSnippet(p.description);
  let description = snippet ? `${lead} ${snippet}` : lead;
  if (description.length < 110 && `${description} ${SHIPPING_TAIL}`.length <= DESCRIPTION_MAX) {
    description = `${description} ${SHIPPING_TAIL}`;
  }
  return { title: withBrand(name), description: truncate(description, DESCRIPTION_MAX) };
}

export const HOME_SEO: SeoText = {
  title: withBrand("Hand Block Print Sarees & Suits from Bagru"),
  description:
    "Authentic Bagru and Ajrakh hand block printed sarees and suits from Rajasthan: cotton, Maheshwari silk, Chanderi and more. Free shipping across India.",
};

export function collectionSeo(c: {
  handle: string;
  title: string;
  productCount: number;
  page?: number;
}): SeoText {
  const page = c.page && c.page > 1 ? c.page : 1;
  let title: string;
  let lead: string;
  if (c.handle === "all") {
    title = "All Hand Block Printed Sarees & Suits";
    lead = `Browse all ${c.productCount} hand block printed sarees and suits`;
  } else if (c.handle === "new-arrivals") {
    title = "New Arrivals: Hand Block Printed Sarees & Suits";
    lead = `See the ${c.productCount} newest hand block printed sarees and suits`;
  } else {
    const nice = smartTitleCase(c.title);
    title = `Buy ${nice} Online`;
    lead = `Shop ${c.productCount} ${nice.toLowerCase()} with traditional Bagru block prints`;
  }
  if (page > 1) title = `${title} (Page ${page})`;
  const tail = "Free shipping across India, COD available, 10% off on prepaid orders.";
  const description = `${lead}${page > 1 ? `, page ${page}` : ""}. ${tail}`;
  return { title: withBrand(title), description: truncate(description, DESCRIPTION_MAX) };
}
