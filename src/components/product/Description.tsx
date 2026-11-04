/** Renders plain-text product copy; blank lines separate paragraphs. */
export function Description({ text }: { text: string }) {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) return null;
  return (
    <section aria-labelledby="product-description" className="mt-8">
      <h2 id="product-description" className="mb-3 text-sm font-semibold tracking-wide uppercase">
        Description
      </h2>
      <div className="space-y-3 text-sm leading-relaxed">
        {paragraphs.map((p, i) => (
          <p key={i} className="whitespace-pre-line">
            {p}
          </p>
        ))}
      </div>
    </section>
  );
}
