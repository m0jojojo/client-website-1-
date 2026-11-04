import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Breadcrumbs } from "@/components/product/Breadcrumbs";
import { Description } from "@/components/product/Description";
import { ProductGallery } from "@/components/product/ProductGallery";
import { MAX_QUANTITY, PurchasePanel } from "@/components/product/PurchasePanel";
import { TrustBadges } from "@/components/product/TrustBadges";
import {
  buildProductJsonLd,
  pickPrimaryCollection,
  serializeJsonLd,
  type ProductDetail,
} from "@/lib/catalog";

const variant = (over: Partial<ProductDetail["variants"][number]> = {}) => ({
  id: "v1",
  title: "Default Title",
  sku: null,
  pricePaise: 129900,
  compareAtPricePaise: 269900,
  inStock: true,
  ...over,
});

const detail = (over: Partial<ProductDetail> = {}): ProductDetail => ({
  handle: "saree-1",
  title: "Yellow Motifs Saree",
  pricePaise: 129900,
  compareAtPricePaise: 269900,
  discountPercent: 52,
  inStock: true,
  imageUrl: "/images/placeholder.svg",
  imageAlt: "Yellow Motifs Saree",
  description: "Soft cotton.",
  tags: [],
  images: [{ url: "/images/placeholder.svg", alt: "Yellow Motifs Saree" }],
  variants: [variant()],
  collections: [],
  ...over,
});

describe("PurchasePanel", () => {
  it("shows sale price, struck regular price, discount badge and tax note", () => {
    render(<PurchasePanel title="T" variants={[variant()]} />);
    expect(screen.getByTestId("price")).toHaveTextContent("₹1,299");
    expect(screen.getByLabelText("Regular price ₹2,699")).toBeInTheDocument();
    expect(screen.getByText("52% OFF")).toBeInTheDocument();
    expect(screen.getByText("Taxes included.")).toBeInTheDocument();
    expect(screen.getByText(/10% off/)).toBeInTheDocument();
  });

  it("hides the discount when the product is not on sale", () => {
    render(<PurchasePanel title="T" variants={[variant({ compareAtPricePaise: null })]} />);
    expect(screen.queryByText(/% OFF/)).not.toBeInTheDocument();
  });

  it("hides the option picker for a single variant", () => {
    render(<PurchasePanel title="T" variants={[variant()]} />);
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(screen.queryByText("Option")).not.toBeInTheDocument();
  });

  it("lets the buyer switch variants and updates the price", () => {
    const variants = [
      variant({ id: "a", title: "Small", pricePaise: 100000, compareAtPricePaise: null }),
      variant({ id: "b", title: "Large", pricePaise: 150000, compareAtPricePaise: null }),
    ];
    render(<PurchasePanel title="T" variants={variants} />);
    expect(screen.getByTestId("price")).toHaveTextContent("₹1,000");
    fireEvent.click(screen.getByLabelText("Large"));
    expect(screen.getByTestId("price")).toHaveTextContent("₹1,500");
  });

  it("starts on the first in-stock variant", () => {
    const variants = [
      variant({ id: "a", title: "Small", inStock: false, pricePaise: 100000 }),
      variant({ id: "b", title: "Large", pricePaise: 150000 }),
    ];
    render(<PurchasePanel title="T" variants={variants} />);
    expect(screen.getByLabelText("Large")).toBeChecked();
    expect(screen.getByRole("button", { name: "Add to cart" })).toBeEnabled();
  });

  it("quantity stepper respects 1..max and typed values are clamped", () => {
    render(<PurchasePanel title="T" variants={[variant()]} />);
    const input = screen.getByLabelText("Quantity") as HTMLInputElement;
    const dec = screen.getByRole("button", { name: "Decrease quantity" });
    const inc = screen.getByRole("button", { name: "Increase quantity" });
    expect(input.value).toBe("1");
    expect(dec).toBeDisabled();
    fireEvent.click(inc);
    expect(input.value).toBe("2");
    fireEvent.change(input, { target: { value: "999" } });
    expect(input.value).toBe(String(MAX_QUANTITY));
    expect(inc).toBeDisabled();
    fireEvent.change(input, { target: { value: "-4" } });
    expect(input.value).toBe("1");
    fireEvent.change(input, { target: { value: "abc" } });
    expect(input.value).toBe("1");
  });

  it("shows a coming-soon notice when no cart handler is wired", () => {
    render(<PurchasePanel title="T" variants={[variant()]} />);
    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));
    expect(screen.getByRole("status")).toHaveTextContent(/cart is coming soon/i);
  });

  it("calls onAddToCart with the variant and quantity when provided", () => {
    const onAdd = vi.fn();
    render(<PurchasePanel title="T" variants={[variant({ id: "v9" })]} onAddToCart={onAdd} />);
    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));
    expect(onAdd).toHaveBeenCalledWith("v9", 2);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("disables the button and says Sold out when out of stock", () => {
    render(<PurchasePanel title="T" variants={[variant({ inStock: false })]} />);
    expect(screen.getByRole("button", { name: "Sold out" })).toBeDisabled();
  });
});

describe("ProductGallery", () => {
  const imgs = [
    { url: "/a.svg", alt: "A" },
    { url: "/b.svg", alt: "B" },
    { url: "/c.svg", alt: "C" },
  ];

  it("with one image shows no thumbnails, arrows or counter", () => {
    render(<ProductGallery images={[imgs[0]]} title="T" />);
    expect(screen.queryByRole("list", { name: "Product images" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next image" })).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "A" })).toBeInTheDocument();
  });

  it("navigates with arrows, thumbnails and the keyboard, wrapping around", () => {
    render(<ProductGallery images={imgs} title="T" />);
    expect(screen.getByText(/1 \/ 3/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next image" }));
    expect(screen.getByText(/2 \/ 3/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show image 3" }));
    expect(screen.getByRole("button", { name: "Show image 3" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Next image" }));
    expect(screen.getByText(/1 \/ 3/)).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("button", { name: "Next image" }), { key: "ArrowLeft" });
    expect(screen.getByText(/3 \/ 3/)).toBeInTheDocument();
  });

  it("opens and closes the larger view", () => {
    render(<ProductGallery images={[imgs[0]]} title="Saree" />);
    fireEvent.click(screen.getByRole("button", { name: "Open image in larger view" }));
    const dialog = document.querySelector("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("open");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(document.querySelector("dialog")).not.toBeInTheDocument();
  });
});

describe("Description, Breadcrumbs, TrustBadges", () => {
  it("splits copy into paragraphs and ignores blanks", () => {
    render(<Description text={"First para.\n\n\nSecond para.\n  \n"} />);
    expect(screen.getAllByText(/para\./)).toHaveLength(2);
  });
  it("renders nothing for an empty description", () => {
    const { container } = render(<Description text="  " />);
    expect(container).toBeEmptyDOMElement();
  });
  it("marks the last breadcrumb as the current page", () => {
    render(
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Cotton Sarees", href: "/collections/cotton-sarees" },
          { label: "Saree" },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: "Cotton Sarees" })).toHaveAttribute(
      "href",
      "/collections/cotton-sarees",
    );
    expect(screen.getByText("Saree")).toHaveAttribute("aria-current", "page");
  });
  it("lists the four trust badges", () => {
    render(<TrustBadges />);
    expect(screen.getByRole("list", { name: "Our promises" }).querySelectorAll("li")).toHaveLength(
      4,
    );
    expect(screen.getByText("7-day easy returns")).toBeInTheDocument();
  });
});

describe("catalog helpers", () => {
  it("pickPrimaryCollection prefers a specific collection over New Arrivals", () => {
    const cols = [{ handle: "new-arrivals" }, { handle: "cotton-sarees" }];
    expect(pickPrimaryCollection(cols)?.handle).toBe("cotton-sarees");
    expect(pickPrimaryCollection([{ handle: "new-arrivals" }])?.handle).toBe("new-arrivals");
    expect(pickPrimaryCollection([])).toBeNull();
  });

  it("buildProductJsonLd outputs a schema.org Product with INR price and availability", () => {
    const ld = buildProductJsonLd(detail());
    expect(ld["@type"]).toBe("Product");
    expect(ld.offers).toMatchObject({
      priceCurrency: "INR",
      price: "1299.00",
      availability: "https://schema.org/InStock",
    });
    expect(buildProductJsonLd(detail({ inStock: false })).offers.availability).toBe(
      "https://schema.org/OutOfStock",
    );
  });

  it("serializeJsonLd cannot break out of a script tag", () => {
    const out = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("</script>");
    expect(JSON.parse(out).name).toBe("</script><script>alert(1)</script>");
  });
});

describe("PurchasePanel pinned Add to cart bar", () => {
  type IOCallback = (entries: { isIntersecting: boolean; intersectionRatio: number }[]) => void;
  let callbacks: IOCallback[] = [];
  let disconnected = 0;

  beforeEach(() => {
    callbacks = [];
    disconnected = 0;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: IOCallback) {
          callbacks.push(cb);
        }
        observe() {}
        disconnect() {
          disconnected++;
        }
      },
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete document.body.dataset.stickyCta;
  });

  const setVisible = (fully: boolean) =>
    act(() => callbacks.at(-1)!([{ isIntersecting: fully, intersectionRatio: fully ? 1 : 0 }]));
  const bar = () => screen.getByTestId("add-to-cart-bar");

  it("stays in place while the button is fully on screen", () => {
    render(<PurchasePanel title="T" variants={[variant()]} />);
    setVisible(true);
    expect(bar().className).not.toContain("fixed");
    expect(document.body.dataset.stickyCta).toBeUndefined();
    expect(screen.queryByText("₹1,299", { selector: "span.block" })).not.toBeInTheDocument();
  });

  it("pins to the bottom of the screen when the button is out of view", () => {
    render(<PurchasePanel title="T" variants={[variant()]} />);
    setVisible(false);
    expect(bar().className).toContain("fixed");
    expect(bar().className).toContain("bottom-0");
    expect(document.body.dataset.stickyCta).toBe("true");
  });

  it("also pins when the button is only partly visible", () => {
    render(<PurchasePanel title="T" variants={[variant()]} />);
    act(() => callbacks.at(-1)!([{ isIntersecting: true, intersectionRatio: 0.4 }]));
    expect(bar().className).toContain("fixed");
  });

  it("goes back into place when the button scrolls into view again", () => {
    render(<PurchasePanel title="T" variants={[variant()]} />);
    setVisible(false);
    setVisible(true);
    expect(bar().className).not.toContain("fixed");
    expect(document.body.dataset.stickyCta).toBeUndefined();
  });

  it("is the very same single button in both places, so there is never a duplicate", () => {
    render(<PurchasePanel title="T" variants={[variant()]} />);
    const before = screen.getByRole("button", { name: "Add to cart" });
    setVisible(false);
    const after = screen.getByRole("button", { name: "Add to cart" });
    expect(screen.getAllByRole("button", { name: /add to cart/i })).toHaveLength(1);
    expect(after).toBe(before);
  });

  it("shows the price beside the button only while pinned, hidden from screen readers", () => {
    render(<PurchasePanel title="T" variants={[variant()]} />);
    setVisible(false);
    const price = bar().querySelector("p[aria-hidden='true']");
    expect(price).toHaveTextContent("₹1,299");
    expect(price).toHaveTextContent("₹2,699");
  });

  it("adds to the cart with the chosen quantity from the pinned bar", async () => {
    const onAdd = vi.fn().mockResolvedValue({ ok: true });
    render(<PurchasePanel title="T" variants={[variant({ id: "v7" })]} onAddToCart={onAdd} />);
    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    setVisible(false);
    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith("v7", 2));
  });

  it("shows the message inside the pinned bar so it is not hidden off screen", async () => {
    const onAdd = vi
      .fn()
      .mockResolvedValue({ ok: false, message: "Sorry, this item is sold out." });
    render(<PurchasePanel title="T" variants={[variant()]} onAddToCart={onAdd} />);
    setVisible(false);
    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));
    const msg = await screen.findByText("Sorry, this item is sold out.");
    expect(bar()).toContainElement(msg);
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("keeps showing a disabled Sold out button when pinned", () => {
    render(<PurchasePanel title="T" variants={[variant({ inStock: false })]} />);
    setVisible(false);
    expect(screen.getByRole("button", { name: "Sold out" })).toBeDisabled();
  });

  it("stops watching and clears the page marker when removed", () => {
    const { unmount } = render(<PurchasePanel title="T" variants={[variant()]} />);
    setVisible(false);
    expect(document.body.dataset.stickyCta).toBe("true");
    unmount();
    expect(disconnected).toBeGreaterThan(0);
    expect(document.body.dataset.stickyCta).toBeUndefined();
  });

  it("works without IntersectionObserver (old browsers): the button simply stays in place", () => {
    vi.unstubAllGlobals();
    // @ts-expect-error simulate a browser without the API
    delete globalThis.IntersectionObserver;
    render(<PurchasePanel title="T" variants={[variant()]} />);
    expect(bar().className).not.toContain("fixed");
  });
});
