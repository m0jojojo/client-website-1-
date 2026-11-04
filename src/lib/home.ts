/** Content and layout config for the home page. Edit here, not in components. */

export const heroSlides = [
  {
    id: "new-arrivals",
    eyebrow: "Just landed",
    title: "New Arrivals",
    body: "Fresh hand block prints straight from the workshops of Bagru.",
    cta: { label: "Shop new arrivals", href: "/collections/new-arrivals" },
    tone: "bg-accent text-accent-foreground",
  },
  {
    id: "maheshwari",
    eyebrow: "Festive favourites",
    title: "Maheshwari Silk Sarees",
    body: "Lightweight silk with traditional block-printed motifs.",
    cta: { label: "Shop Maheshwari silks", href: "/collections/maheshwari-silk-sarees" },
    tone: "bg-[#5b3a29] text-white",
  },
  {
    id: "suits",
    eyebrow: "Everyday elegance",
    title: "Cotton Suit Sets",
    body: "Breathable unstitched cotton suits with Kota Doriya dupattas.",
    cta: { label: "Shop suits", href: "/collections/cotton-suit-sets" },
    tone: "bg-[#2f4f3e] text-white",
  },
] as const;

export const categoryTiles = [
  { handle: "modal-silk-sarees", title: "Modal Silk Sarees" },
  { handle: "nashpal-mulcotton-sarees", title: "Nashpal Mulcotton Sarees" },
  { handle: "chanderi-silk-sarees", title: "Chanderi Silk Sarees" },
  { handle: "maheshwari-silk-sarees", title: "Maheshwari Silk Sarees" },
  { handle: "cotton-sarees", title: "Cotton Sarees" },
  { handle: "cotton-linen-sarees", title: "Cotton Linen Sarees" },
  { handle: "nashpal-pomegranate-sarees", title: "Nashpal Pomegranate Sarees" },
  { handle: "double-diamond-chiffon-sarees", title: "Double Diamond Chiffon Sarees" },
  { handle: "mulmul-sarees", title: "Mulmul Sarees" },
  { handle: "cotton-suit-sets", title: "Cotton Suit Sets" },
  { handle: "linen-suits", title: "Linen Suits" },
  { handle: "kota-dupatta-cotton-suits", title: "Kota Dupatta Cotton Suits" },
  { handle: "linen-dupatta-cotton-suit", title: "Linen Dupatta Cotton Suit" },
] as const;

export const productSections = [
  { title: "Trending Now", viewAllHref: "/collections/new-arrivals", collection: "new-arrivals" },
  {
    title: "Saree Collection",
    viewAllHref: "/collections/maheshwari-silk-sarees",
    collection: "maheshwari-silk-sarees",
  },
  {
    title: "Mulmul Sarees",
    viewAllHref: "/collections/mulmul-sarees",
    collection: "mulmul-sarees",
  },
  {
    title: "Suits Collection",
    viewAllHref: "/collections/kota-dupatta-cotton-suits",
    collection: "kota-dupatta-cotton-suits",
  },
  { title: "Shop All", viewAllHref: "/collections/all", collection: undefined },
] as const;

export const trustItems = [
  { title: "Free Shipping*", text: "On all orders" },
  { title: "Secured Payments", text: "100% secure checkout" },
  { title: "Cash on Delivery*", text: "Available across India" },
  { title: "Easy Customer Support", text: "Call or WhatsApp us" },
] as const;

/** PLACEHOLDER testimonials. Replace with real customer reviews before launch. */
export const testimonials = [
  {
    quote: "Sample review: the fabric feels soft and the prints look just like the photos.",
    name: "Sample Customer",
    place: "City",
  },
  {
    quote: "Sample review: lovely hand block work and quick delivery. Will order again.",
    name: "Sample Customer",
    place: "City",
  },
  {
    quote: "Sample review: pure cotton, great fit for everyday wear, packed with care.",
    name: "Sample Customer",
    place: "City",
  },
] as const;
