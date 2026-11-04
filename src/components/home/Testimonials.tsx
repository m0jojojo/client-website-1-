import { siteConfig } from "@/lib/site";
import { testimonials } from "@/lib/home";

export function Testimonials() {
  return (
    <section aria-labelledby="testimonials" className="mx-auto max-w-7xl px-4 py-12">
      <h2 id="testimonials" className="text-center text-xl font-semibold tracking-wide uppercase">
        Voices of Royalty
      </h2>
      <p className="text-muted mx-auto mt-2 max-w-xl text-center text-sm">
        Hear from our cherished patrons about their experience with {siteConfig.name}.
      </p>
      <ul className="mt-8 grid gap-6 md:grid-cols-3">
        {testimonials.map((t, i) => (
          <li key={i}>
            <figure className="border-border h-full rounded-sm border p-6">
              <blockquote className="text-sm leading-relaxed">&ldquo;{t.quote}&rdquo;</blockquote>
              <figcaption className="mt-4 text-sm font-medium">
                {t.name}
                <span className="text-muted block text-xs font-normal">{t.place}</span>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}
