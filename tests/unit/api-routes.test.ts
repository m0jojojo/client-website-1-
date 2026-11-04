import { GET as listProductsRoute } from "@/app/api/products/route";
import { GET as productRoute } from "@/app/api/products/[handle]/route";
import { GET as collectionsRoute } from "@/app/api/collections/route";
import { GET as collectionRoute } from "@/app/api/collections/[handle]/route";

const mocks = vi.hoisted(() => ({
  listProducts: vi.fn(),
  getProductByHandle: vi.fn(),
  listCollections: vi.fn(),
  getCollectionByHandle: vi.fn(),
}));
vi.mock("@/lib/catalog", () => mocks);
vi.mock("next/server", async (orig) => ({
  ...(await orig<typeof import("next/server")>()),
  connection: vi.fn(async () => {}),
}));

const req = (path: string) => new Request(`http://localhost${path}`);
const ctx = (handle: string) => ({ params: Promise.resolve({ handle }) }) as never;

beforeEach(() => vi.clearAllMocks());

describe("GET /api/products", () => {
  it("passes validated params to listProducts", async () => {
    mocks.listProducts.mockResolvedValue({
      items: [],
      total: 0,
      page: 2,
      pageSize: 12,
      totalPages: 1,
    });
    const res = await listProductsRoute(req("/api/products?page=2&pageSize=12&sort=price-desc"));
    expect(res.status).toBe(200);
    expect(mocks.listProducts).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, pageSize: 12, sort: "price-desc" }),
    );
  });
  it("returns 400 for invalid params without hitting the data layer", async () => {
    const res = await listProductsRoute(req("/api/products?page=-1"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/invalid/i);
    expect(mocks.listProducts).not.toHaveBeenCalled();
  });
});

describe("GET /api/products/[handle]", () => {
  it("returns the product", async () => {
    mocks.getProductByHandle.mockResolvedValue({ handle: "a", title: "A" });
    const res = await productRoute(req("/api/products/a"), ctx("a"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ handle: "a" });
  });
  it("returns 404 when missing", async () => {
    mocks.getProductByHandle.mockResolvedValue(null);
    const res = await productRoute(req("/api/products/x"), ctx("x"));
    expect(res.status).toBe(404);
  });
});

describe("collections routes", () => {
  it("lists collections", async () => {
    mocks.listCollections.mockResolvedValue([{ handle: "c", title: "C", productCount: 1 }]);
    const res = await collectionsRoute();
    expect(await res.json()).toEqual({ items: [{ handle: "c", title: "C", productCount: 1 }] });
  });
  it("returns collection with its products", async () => {
    mocks.getCollectionByHandle.mockResolvedValue({ handle: "c", title: "C" });
    mocks.listProducts.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 24,
      totalPages: 1,
    });
    const res = await collectionRoute(req("/api/collections/c"), ctx("c"));
    expect(res.status).toBe(200);
    expect(mocks.listProducts).toHaveBeenCalledWith(expect.objectContaining({ collection: "c" }));
  });
  it("404s for an unknown collection", async () => {
    mocks.getCollectionByHandle.mockResolvedValue(null);
    expect((await collectionRoute(req("/api/collections/z"), ctx("z"))).status).toBe(404);
  });
});
