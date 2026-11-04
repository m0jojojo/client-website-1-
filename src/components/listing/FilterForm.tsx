import Link from "next/link";
import { formatRupees, type Facets, type ListingState } from "@/lib/catalog";
import { Button } from "@/components/ui/Button";
import { SortSelect } from "./SortSelect";

/** A plain GET form: works without JavaScript, and every filter state is a shareable URL. */
export function FilterForm({
  basePath,
  state,
  facets,
}: {
  basePath: string;
  state: ListingState;
  facets: Facets;
}) {
  const has = (v: "in-stock" | "out-of-stock") => state.availability.includes(v);
  const maxRupees = Math.ceil(facets.maxPricePaise / 100);

  return (
    <form
      action={basePath}
      method="get"
      className="space-y-6"
      aria-label="Filter and sort products"
    >
      {state.q && <input type="hidden" name="q" value={state.q} />}
      <SortSelect value={state.sort} />

      <fieldset>
        <legend className="mb-2 text-sm font-semibold tracking-wide uppercase">Availability</legend>
        <div className="space-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="availability"
              value="in-stock"
              defaultChecked={has("in-stock")}
            />
            In stock <span className="text-muted">({facets.inStock})</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="availability"
              value="out-of-stock"
              defaultChecked={has("out-of-stock")}
            />
            Out of stock <span className="text-muted">({facets.outOfStock})</span>
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1 text-sm font-semibold tracking-wide uppercase">Price</legend>
        {maxRupees > 0 && (
          <p className="text-muted mb-2 text-xs">
            The highest price is {formatRupees(facets.maxPricePaise)}
          </p>
        )}
        <div className="flex items-center gap-2 text-sm">
          <label className="flex-1">
            <span className="sr-only">Minimum price in rupees</span>
            <input
              type="number"
              name="minPrice"
              min={0}
              inputMode="numeric"
              placeholder="From ₹"
              defaultValue={state.minPrice}
              className="border-border h-10 w-full rounded-sm border px-2"
            />
          </label>
          <span aria-hidden="true">&ndash;</span>
          <label className="flex-1">
            <span className="sr-only">Maximum price in rupees</span>
            <input
              type="number"
              name="maxPrice"
              min={0}
              inputMode="numeric"
              placeholder="To ₹"
              defaultValue={state.maxPrice}
              className="border-border h-10 w-full rounded-sm border px-2"
            />
          </label>
        </div>
      </fieldset>

      <div className="flex items-center gap-4">
        <Button type="submit" size="sm">
          Apply
        </Button>
        <Link
          href={state.q ? `${basePath}?q=${encodeURIComponent(state.q)}` : basePath}
          className="text-sm underline-offset-4 hover:underline"
        >
          Clear all
        </Link>
      </div>
    </form>
  );
}
