import type { Metadata } from "next";
import { Suspense } from "react";
import { CategoryTiles } from "@/components/home/CategoryTiles";
import { HeroSlider } from "@/components/home/HeroSlider";
import { ProductSection, ProductSectionSkeleton } from "@/components/home/ProductSection";
import { Testimonials } from "@/components/home/Testimonials";
import { TrustStrip } from "@/components/home/TrustStrip";
import { productSections } from "@/lib/home";
import { HOME_SEO } from "@/lib/seo/copy";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: HOME_SEO.title },
  description: HOME_SEO.description,
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <main>
      <h1 className="sr-only">{siteConfig.name}: handcrafted block-printed sarees and suits</h1>
      <HeroSlider />
      <CategoryTiles />
      {productSections.map((s) => (
        <Suspense key={s.title} fallback={<ProductSectionSkeleton />}>
          <ProductSection title={s.title} viewAllHref={s.viewAllHref} collection={s.collection} />
        </Suspense>
      ))}
      <TrustStrip />
      <Testimonials />
    </main>
  );
}
