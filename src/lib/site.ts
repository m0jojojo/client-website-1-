export const siteConfig = {
  name: "The Block Bagru",
  tagline:
    "Authentic handcrafted block print ethnic wear from the heart of Rajasthan. Traditional Bagru & Ajrakh prints.",
  email: "theblockbagru@gmail.com",
  phone: "+91 97859 87678",
  address: "Shop No. 01, 02, Jogiyo ka mohalla, Bagru, Jaipur, Rajasthan",
  gstin: "08DROPB8925H1ZE",
  copyrightYear: 2026,
  // Digits only, with country code. Placeholder until the real number is supplied via env.
  whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "910000000000",
  promo: [
    "Get 10% off on all prepaid orders",
    "Free shipping",
    "COD available",
    "Authentic Bagru hand block prints",
  ],
} as const;

export type NavLink = { label: string; href: string };
export type NavItem = NavLink & { children?: NavLink[] };

export const mainNav: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "New Arrivals", href: "/collections/new-arrivals" },
  {
    label: "Sarees",
    href: "/collections/maheshwari-silk-sarees",
    children: [
      { label: "Chanderi Silk Sarees", href: "/collections/chanderi-silk-sarees" },
      { label: "Maheshwari Silk Sarees", href: "/collections/maheshwari-silk-sarees" },
      { label: "Cotton Sarees", href: "/collections/cotton-sarees" },
      { label: "Nashpal Pomegranate Sarees", href: "/collections/nashpal-pomegranate-sarees" },
      {
        label: "Double Diamond Chiffon Sarees",
        href: "/collections/double-diamond-chiffon-sarees",
      },
      { label: "Mulmul Sarees", href: "/collections/mulmul-sarees" },
    ],
  },
  {
    label: "Suits",
    href: "/collections/cotton-suit-sets",
    children: [
      { label: "Cotton Suit Sets", href: "/collections/cotton-suit-sets" },
      { label: "Linen Suits", href: "/collections/linen-suits" },
      { label: "Kota Dupatta Cotton Suits", href: "/collections/kota-dupatta-cotton-suits" },
      { label: "Linen Dupatta Cotton Suit", href: "/collections/linen-dupatta-cotton-suit" },
    ],
  },
  { label: "About", href: "/pages/about" },
  { label: "Contact", href: "/pages/contact" },
];

export const footerLinks = {
  quick: [
    { label: "Home", href: "/" },
    { label: "New Arrivals", href: "/collections/new-arrivals" },
    { label: "Sarees", href: "/collections/maheshwari-silk-sarees" },
  ] satisfies NavLink[],
  care: [
    { label: "Contact Us", href: "/pages/contact" },
    { label: "Shipping Info", href: "/policies/shipping" },
    { label: "Return Policy", href: "/policies/returns" },
    { label: "Privacy Policy", href: "/policies/privacy" },
    { label: "Terms of Service", href: "/policies/terms" },
  ] satisfies NavLink[],
};
