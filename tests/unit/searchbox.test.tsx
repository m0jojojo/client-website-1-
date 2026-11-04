import { act, fireEvent, render, screen } from "@testing-library/react";
import { SearchBox } from "@/components/layout/SearchBox";

const item = (n: number) => ({
  handle: `saree-${n}`,
  title: `Cotton Saree ${n}`,
  pricePaise: 129900,
  compareAtPricePaise: null,
  discountPercent: 0,
  inStock: true,
  imageUrl: "/x.svg",
  imageAlt: "x",
});

const fetchMock = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const open = () => fireEvent.click(screen.getByRole("button", { name: "Search" }));
const type = (v: string) =>
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: v } });
const flush = async (ms = 300) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

describe("SearchBox", () => {
  it("opens a search form that submits to /search?q=", () => {
    render(<SearchBox />);
    expect(screen.queryByRole("search")).not.toBeInTheDocument();
    open();
    const form = screen.getByRole("search", { name: "Search products" });
    expect(form).toHaveAttribute("action", "/search");
    expect(form).toHaveAttribute("method", "get");
    expect(screen.getByRole("searchbox")).toHaveAttribute("name", "q");
  });

  it("does not fetch for fewer than 2 characters", async () => {
    render(<SearchBox />);
    open();
    type("c");
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("debounces typing into a single request and lists suggestions", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ items: [item(1), item(2)] }) });
    render(<SearchBox />);
    open();
    type("co");
    await flush(100);
    type("cot");
    await flush(100);
    type("cotton");
    await flush(300);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/products?q=cotton&pageSize=6");
    const list = screen.getByRole("list", { name: "Search suggestions" });
    expect(list.querySelectorAll("a")).toHaveLength(2);
    expect(screen.getByRole("link", { name: /Cotton Saree 1/ })).toHaveAttribute(
      "href",
      "/products/saree-1",
    );
    expect(screen.getByRole("link", { name: /See all results for/ })).toHaveAttribute(
      "href",
      "/search?q=cotton",
    );
    expect(screen.getByRole("status")).toHaveTextContent("2 suggestions");
  });

  it("encodes special characters in the query", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ items: [] }) });
    render(<SearchBox />);
    open();
    type("a&b c");
    await flush();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/products?q=a%26b%20c&pageSize=6");
  });

  it("says when nothing matches", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ items: [] }) });
    render(<SearchBox />);
    open();
    type("zzzz");
    await flush();
    expect(screen.getByText(/No products found for/)).toBeInTheDocument();
  });

  it("falls back gracefully when the request fails", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    render(<SearchBox />);
    open();
    type("cotton");
    await flush();
    expect(screen.getByRole("status")).toHaveTextContent(/unavailable/);
    expect(screen.getByRole("searchbox")).toBeInTheDocument();
  });

  it("aborts the previous request when the query changes", async () => {
    const signals: AbortSignal[] = [];
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      signals.push(init.signal as AbortSignal);
      return new Promise(() => {});
    });
    render(<SearchBox />);
    open();
    type("cotton");
    await flush();
    type("linen");
    expect(signals[0].aborted).toBe(true);
  });

  it("closes on Escape and returns focus to the toggle", () => {
    render(<SearchBox />);
    open();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("search")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search" })).toHaveFocus();
  });

  it("closes when clicking outside", () => {
    render(<SearchBox />);
    open();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("search")).not.toBeInTheDocument();
  });
});
