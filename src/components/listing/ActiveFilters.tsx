import Link from "next/link";
import { formatRupees, listingQuery, type ListingState } from "@/lib/catalog";

export function ActiveFilters({ basePath, state }: { basePath: string; state: ListingState }) {
  const href = (patch: Partial<ListingState>) =>
    `${basePath}${listingQuery({ ...state, page: 1, ...patch })}`;
  const chips: { label: string; to: string }[] = [];

  for (const a of state.availability) {
    chips.push({
      label: a === "in-stock" ? "In stock" : "Out of stock",
      to: href({ availability: state.availability.filter((x) => x !== a) }),
    });
  }
  if (state.minPrice !== undefined || state.maxPrice !== undefined) {
    const lo = formatRupees((state.minPrice ?? 0) * 100);
    const label =
      state.maxPrice === undefined ? `From ${lo}` : `${lo} – ${formatRupees(state.maxPrice * 100)}`;
    chips.push({ label, to: href({ minPrice: undefined, maxPrice: undefined }) });
  }
  if (chips.length === 0) return null;

  return (
    <ul aria-label="Active filters" className="flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <li key={c.label}>
          <Link
            href={c.to}
            className="border-border bg-surface hover:bg-border inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm"
          >
            {c.label}
            <span aria-hidden="true">&times;</span>
            <span className="sr-only">Remove filter</span>
          </Link>
        </li>
      ))}
      <li>
        <Link
          href={href({ availability: [], minPrice: undefined, maxPrice: undefined })}
          className="text-sm underline-offset-4 hover:underline"
        >
          Remove all
        </Link>
      </li>
    </ul>
  );
}
