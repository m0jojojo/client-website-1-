import { siteConfig } from "@/lib/site";

export function PromoStrip() {
  return (
    <div
      role="region"
      aria-label="Store announcements"
      className="bg-accent text-accent-foreground px-4 py-2 text-center text-xs font-semibold tracking-wide uppercase"
    >
      {siteConfig.promo.join(" | ")}
    </div>
  );
}
