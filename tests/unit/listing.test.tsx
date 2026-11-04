import { fireEvent, render, screen, within } from "@testing-library/react";
import { ActiveFilters } from "@/components/listing/ActiveFilters";
import { FilterForm } from "@/components/listing/FilterForm";
import { FilterToggle } from "@/components/listing/FilterToggle";
import { ListingView } from "@/components/listing/ListingView";
import { Pagination } from "@/components/listing/Pagination";
import type { ListingState, ProductSummary } from "@/lib/catalog";

const base: ListingState = { sort: "featured", availability: [], page: 1 };
const facets = { inStock: 50, outOfStock: 17, maxPricePaise: 129900 };
const product = (n: number): ProductSummary => ({
  handle: `p-${n}`,
  title: `Product ${n}`,
  pricePaise: 129900,
  compareAtPricePaise: 269900,
  discountPercent: 52,
  inStock: true,
  imageUrl: "/images/placeholder.svg",
  imageAlt: `Product ${n}`,
});

describe("Pagination", () => {
  it("renders nothing for a single page", () => {
    const { container } = render(
      <Pagination basePath="/collections/x" state={base} totalPages={1} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
  it("marks the current page and links to neighbours, keeping filters", () => {
    const state: ListingState = {
      ...base,
      page: 2,
      sort: "price-asc",
      availability: ["in-stock"],
      minPrice: 500,
    };
    render(<Pagination basePath="/collections/x" state={state} totalPages={5} />);
    expect(screen.getByRole("link", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Page 3" })).toHaveAttribute(
      "href",
      "/collections/x?sort=price-asc&availability=in-stock&minPrice=500&page=3",
    );
    expect(screen.getByRole("link", { name: "Previous page" })).toHaveAttribute(
      "href",
      "/collections/x?sort=price-asc&availability=in-stock&minPrice=500",
    );
    expect(screen.getByRole("link", { name: "Next page" })).toBeInTheDocument();
  });
  it("hides Previous on the first page and Next on the last", () => {
    const { rerender } = render(<Pagination basePath="/c" state={base} totalPages={3} />);
    expect(screen.queryByRole("link", { name: "Previous page" })).not.toBeInTheDocument();
    rerender(<Pagination basePath="/c" state={{ ...base, page: 3 }} totalPages={3} />);
    expect(screen.queryByRole("link", { name: "Next page" })).not.toBeInTheDocument();
  });
});

describe("FilterForm", () => {
  it("is a GET form to the base path with 7 sort options and facet counts", () => {
    render(<FilterForm basePath="/collections/cotton-sarees" state={base} facets={facets} />);
    const form = screen.getByRole("form", { name: "Filter and sort products" });
    expect(form).toHaveAttribute("action", "/collections/cotton-sarees");
    expect(form).toHaveAttribute("method", "get");
    expect(within(screen.getByRole("combobox")).getAllByRole("option")).toHaveLength(7);
    expect(screen.getByLabelText(/In stock/)).toHaveAccessibleName(/In stock \(50\)/);
    expect(screen.getByLabelText(/Out of stock/)).toHaveAccessibleName(/Out of stock \(17\)/);
    expect(screen.getByText(/highest price is ₹1,299/)).toBeInTheDocument();
  });
  it("reflects the current state and keeps the search term as a hidden field", () => {
    const state: ListingState = {
      ...base,
      q: "cotton",
      sort: "title-desc",
      availability: ["in-stock"],
      minPrice: 500,
      maxPrice: 1200,
    };
    render(<FilterForm basePath="/search" state={state} facets={facets} />);
    expect(screen.getByRole("combobox")).toHaveValue("title-desc");
    expect(screen.getByLabelText(/In stock/)).toBeChecked();
    expect(screen.getByLabelText(/Out of stock/)).not.toBeChecked();
    expect(screen.getByLabelText("Minimum price in rupees")).toHaveValue(500);
    expect(screen.getByLabelText("Maximum price in rupees")).toHaveValue(1200);
    expect(document.querySelector('input[type="hidden"][name="q"]')).toHaveValue("cotton");
  });
  it("submits the form when the sort changes", () => {
    render(<FilterForm basePath="/c" state={base} facets={facets} />);
    const form = screen.getByRole("form", { name: "Filter and sort products" }) as HTMLFormElement;
    form.requestSubmit = vi.fn();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "price-asc" } });
    expect(form.requestSubmit).toHaveBeenCalledTimes(1);
  });
  it("Clear all links back to the unfiltered page", () => {
    render(<FilterForm basePath="/search" state={{ ...base, q: "red saree" }} facets={facets} />);
    expect(screen.getByRole("link", { name: "Clear all" })).toHaveAttribute(
      "href",
      "/search?q=red%20saree",
    );
  });
});

describe("FilterToggle", () => {
  it("toggles the filter panel with aria-expanded", () => {
    render(
      <FilterToggle>
        <p>panel</p>
      </FilterToggle>,
    );
    const btn = screen.getByRole("button", { name: /Filter and sort/ });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
  });
});

describe("ActiveFilters", () => {
  it("renders nothing without filters", () => {
    const { container } = render(<ActiveFilters basePath="/c" state={base} />);
    expect(container).toBeEmptyDOMElement();
  });
  it("shows removable chips that reset to page 1 and keep other state", () => {
    const state: ListingState = {
      ...base,
      page: 3,
      sort: "price-asc",
      availability: ["in-stock", "out-of-stock"],
      minPrice: 500,
      maxPrice: 1500,
    };
    render(<ActiveFilters basePath="/c" state={state} />);
    expect(screen.getByRole("link", { name: /^In stock/ })).toHaveAttribute(
      "href",
      "/c?sort=price-asc&availability=out-of-stock&minPrice=500&maxPrice=1500",
    );
    expect(screen.getByRole("link", { name: /₹500 – ₹1,500/ })).toHaveAttribute(
      "href",
      "/c?sort=price-asc&availability=in-stock&availability=out-of-stock",
    );
    expect(screen.getByRole("link", { name: "Remove all" })).toHaveAttribute(
      "href",
      "/c?sort=price-asc",
    );
  });
});

describe("ListingView", () => {
  const page = (items: ProductSummary[], total = items.length, totalPages = 1) => ({
    items,
    total,
    page: 1,
    pageSize: 24,
    totalPages,
  });
  it("shows title, count, products and pagination", () => {
    render(
      <ListingView
        title="Cotton Sarees"
        countLabel="67 products"
        basePath="/collections/cotton-sarees"
        state={base}
        result={page([product(1), product(2)], 67, 3)}
        facets={facets}
      />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Cotton Sarees" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("67 products");
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.getByRole("navigation", { name: "Pagination" })).toBeInTheDocument();
  });
  it("shows an empty state with a way out", () => {
    render(
      <ListingView
        title="Cotton Sarees"
        countLabel="0 products"
        basePath="/collections/cotton-sarees"
        state={{ ...base, availability: ["out-of-stock"] }}
        result={page([])}
        facets={facets}
        emptyMessage="Nothing here."
      />,
    );
    expect(screen.getByText("Nothing here.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear all filters" })).toHaveAttribute(
      "href",
      "/collections/cotton-sarees",
    );
  });
});
