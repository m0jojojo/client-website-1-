import Link from "next/link";
import { footerLinks, siteConfig } from "@/lib/site";

function LinkList({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <nav aria-label={title}>
      <h2 className="mb-3 text-sm font-semibold tracking-wide uppercase">{title}</h2>
      <ul className="text-muted space-y-2 text-sm">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="hover:text-foreground hover:underline">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="border-border bg-surface mt-auto border-t">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <h2 className="mb-3 text-lg font-semibold">{siteConfig.name}</h2>
          <p className="text-muted text-sm">{siteConfig.tagline}</p>
        </div>
        <LinkList title="Quick links" links={footerLinks.quick} />
        <LinkList title="Customer care" links={footerLinks.care} />
        <div>
          <h2 className="mb-3 text-sm font-semibold tracking-wide uppercase">Contact</h2>
          <address className="text-muted space-y-2 text-sm not-italic">
            <p>
              Email:{" "}
              <a className="hover:underline" href={`mailto:${siteConfig.email}`}>
                {siteConfig.email}
              </a>
            </p>
            <p>
              Phone:{" "}
              <a className="hover:underline" href={`tel:${siteConfig.phone.replace(/\s/g, "")}`}>
                {siteConfig.phone}
              </a>
            </p>
            <p>{siteConfig.address}</p>
            <p>GSTIN: {siteConfig.gstin}</p>
          </address>
        </div>
      </div>
      <div className="border-border text-muted border-t py-4 text-center text-xs">
        &copy; {siteConfig.copyrightYear} {siteConfig.name.toUpperCase()}. All rights reserved.
      </div>
    </footer>
  );
}
