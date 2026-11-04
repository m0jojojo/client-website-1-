import { trustItems } from "@/lib/home";

export function TrustStrip() {
  return (
    <section aria-label="Why shop with us" className="border-border bg-surface border-y">
      <ul className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-8 text-center lg:grid-cols-4">
        {trustItems.map((t) => (
          <li key={t.title}>
            <p className="text-sm font-semibold tracking-wide uppercase">{t.title}</p>
            <p className="text-muted mt-1 text-xs uppercase">{t.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
