import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { ProductCard } from "@/components/catalog/ProductCard";
import { CategoryTiles } from "@/components/home/CategoryTiles";
import { HeroSlider } from "@/components/home/HeroSlider";
import { ProductSectionView } from "@/components/home/ProductSection";
import { Testimonials } from "@/components/home/Testimonials";
import { TrustStrip } from "@/components/home/TrustStrip";
import { Carousel, CarouselItem } from "@/components/ui/Carousel";
import type { ProductSummary } from "@/lib/catalog";
import { categoryTiles, heroSlides, productSections, testimonials } from "@/lib/home";

const product = (over: Partial<ProductSummary> = {}): ProductSummary => ({
  handle: "saree-1",
  title: "Maheshwari Silk Saree",
  pricePaise: 289900,
  compareAtPricePaise: 489900,
  discountPercent: 41,
  inStock: true,
  imageUrl: "/images/placeholder.svg",
  imageAlt: "Maheshwari Silk Saree",
  ...over,
});

describe("ProductCard", () => {
  it("shows title, sale price, struck regular price, discount badge and link", () => {
    render(<ProductCard product={product()} />);
    expect(screen.getByRole("link", { name: /Maheshwari Silk Saree/ })).toHaveAttribute(
      "href",
      "/products/saree-1",
    );
    expect(screen.getByText("₹2,899")).toBeInTheDocument();
    expect(screen.getByLabelText("Regular price ₹4,899")).toBeInTheDocument();
    expect(screen.getByText("41% OFF")).toBeInTheDocument();
  });

  it("shows only the price when not on sale", () => {
    render(<ProductCard product={product({ compareAtPricePaise: null, discountPercent: 0 })} />);
    expect(screen.getByText("₹2,899")).toBeInTheDocument();
    expect(screen.queryByText(/OFF/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Regular price/)).not.toBeInTheDocument();
  });

  it("shows a Sold out badge instead of the discount when out of stock", () => {
    render(<ProductCard product={product({ inStock: false })} />);
    expect(screen.getByText("Sold out")).toBeInTheDocument();
    expect(screen.queryByText("41% OFF")).not.toBeInTheDocument();
  });
});

describe("Carousel", () => {
  it("is a labelled carousel region with prev/next buttons that scroll the track", () => {
    render(
      <Carousel label="Trending Now">
        <CarouselItem>a</CarouselItem>
        <CarouselItem>b</CarouselItem>
      </Carousel>,
    );
    const region = screen.getByRole("region", { name: "Trending Now" });
    const list = within(region).getByRole("list");
    list.scrollBy = vi.fn();
    fireEvent.click(screen.getByRole("button", { name: "Next Trending Now" }));
    expect(list.scrollBy).toHaveBeenCalledWith(
      expect.objectContaining({ left: expect.any(Number) }),
    );
    expect(
      (list.scrollBy as ReturnType<typeof vi.fn>).mock.calls[0][0].left,
    ).toBeGreaterThanOrEqual(0);
    fireEvent.click(screen.getByRole("button", { name: "Previous Trending Now" }));
    expect((list.scrollBy as ReturnType<typeof vi.fn>).mock.calls[1][0].left).toBeLessThanOrEqual(
      0,
    );
  });
});

describe("ProductSectionView", () => {
  it("renders heading, View all link and one card per product", () => {
    render(
      <ProductSectionView
        title="Mulmul Sarees"
        viewAllHref="/collections/mulmul-sarees"
        products={[product({ handle: "a", title: "A" }), product({ handle: "b", title: "B" })]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Mulmul Sarees" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View all/ })).toHaveAttribute(
      "href",
      "/collections/mulmul-sarees",
    );
    expect(screen.getAllByRole("article")).toHaveLength(2);
  });
});

describe("HeroSlider", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const visibleTitle = () => screen.getByRole("heading", { level: 2 }).textContent;

  it("starts on the first slide and the buttons wrap around", () => {
    render(<HeroSlider />);
    expect(visibleTitle()).toBe(heroSlides[0].title);
    fireEvent.click(screen.getByRole("button", { name: "Previous slide" }));
    expect(visibleTitle()).toBe(heroSlides[heroSlides.length - 1].title);
    fireEvent.click(screen.getByRole("button", { name: "Next slide" }));
    expect(visibleTitle()).toBe(heroSlides[0].title);
  });

  it("jumps via dots and marks the current one", () => {
    render(<HeroSlider />);
    fireEvent.click(screen.getByRole("button", { name: "Go to slide 2" }));
    expect(visibleTitle()).toBe(heroSlides[1].title);
    expect(screen.getByRole("button", { name: "Go to slide 2" })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("auto-advances and pauses while hovered", () => {
    render(<HeroSlider />);
    act(() => vi.advanceTimersByTime(6100));
    expect(visibleTitle()).toBe(heroSlides[1].title);
    const region = screen.getByRole("region", { name: "Featured collections" });
    fireEvent.mouseEnter(region);
    act(() => vi.advanceTimersByTime(20000));
    expect(visibleTitle()).toBe(heroSlides[1].title);
    fireEvent.mouseLeave(region);
    act(() => vi.advanceTimersByTime(6100));
    expect(visibleTitle()).toBe(heroSlides[2].title);
  });

  it("does not auto-advance when the user prefers reduced motion", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as never;
    render(<HeroSlider />);
    act(() => vi.advanceTimersByTime(20000));
    expect(visibleTitle()).toBe(heroSlides[0].title);
    // @ts-expect-error cleanup of test stub
    delete window.matchMedia;
  });

  it("each slide has a working call-to-action link", () => {
    render(<HeroSlider />);
    expect(screen.getByRole("link", { name: heroSlides[0].cta.label })).toHaveAttribute(
      "href",
      heroSlides[0].cta.href,
    );
  });
});

describe("CategoryTiles", () => {
  it("renders all 13 categories linking to their collection", () => {
    render(<CategoryTiles />);
    expect(categoryTiles).toHaveLength(13);
    const links = within(screen.getByRole("region", { name: "Shop By Category" })).getAllByRole(
      "link",
    );
    expect(links).toHaveLength(13);
    expect(screen.getByRole("link", { name: "Mulmul Sarees" })).toHaveAttribute(
      "href",
      "/collections/mulmul-sarees",
    );
  });
});

describe("TrustStrip and Testimonials", () => {
  it("shows the four trust items", () => {
    render(<TrustStrip />);
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByText("Cash on Delivery*")).toBeInTheDocument();
  });
  it("shows the placeholder testimonials", () => {
    render(<Testimonials />);
    expect(screen.getByRole("heading", { name: "Voices of Royalty" })).toBeInTheDocument();
    expect(screen.getAllByRole("figure")).toHaveLength(testimonials.length);
  });
});

describe("home config", () => {
  it("has five product sections with unique titles", () => {
    expect(new Set(productSections.map((s) => s.title)).size).toBe(5);
  });
  it("tile handles are unique", () => {
    expect(new Set(categoryTiles.map((c) => c.handle)).size).toBe(categoryTiles.length);
  });
});
