import Link from "next/link";

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-muted text-sm">
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((c, i) => (
          <li key={c.label} className="flex items-center gap-2">
            {c.href ? (
              <Link href={c.href} className="hover:text-foreground hover:underline">
                {c.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-foreground">
                {c.label}
              </span>
            )}
            {i < items.length - 1 && <span aria-hidden="true">/</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
