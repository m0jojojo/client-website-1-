import Link from "next/link";
import { listingQuery, pageWindow, type ListingState } from "@/lib/catalog";

export function Pagination({
  basePath,
  state,
  totalPages,
}: {
  basePath: string;
  state: ListingState;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;
  const href = (page: number) => `${basePath}${listingQuery({ ...state, page })}`;
  const item = "flex h-10 min-w-10 items-center justify-center rounded-sm border px-3 text-sm";

  return (
    <nav aria-label="Pagination" className="mt-10">
      <ul className="flex flex-wrap items-center justify-center gap-2">
        {state.page > 1 && (
          <li>
            <Link
              href={href(state.page - 1)}
              rel="prev"
              className={`${item} border-border hover:bg-surface`}
            >
              <span aria-hidden="true">&lsaquo;</span>
              <span className="sr-only">Previous page</span>
            </Link>
          </li>
        )}
        {pageWindow(state.page, totalPages).map((n, i) =>
          n === null ? (
            <li key={`gap-${i}`} aria-hidden="true" className="text-muted px-1">
              &hellip;
            </li>
          ) : (
            <li key={n}>
              <Link
                href={href(n)}
                aria-label={`Page ${n}`}
                aria-current={n === state.page ? "page" : undefined}
                className={`${item} ${
                  n === state.page
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-border hover:bg-surface"
                }`}
              >
                {n}
              </Link>
            </li>
          ),
        )}
        {state.page < totalPages && (
          <li>
            <Link
              href={href(state.page + 1)}
              rel="next"
              className={`${item} border-border hover:bg-surface`}
            >
              <span aria-hidden="true">&rsaquo;</span>
              <span className="sr-only">Next page</span>
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}
