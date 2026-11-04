import { NextResponse } from "next/server";
import { getCollectionByHandle, listProducts } from "@/lib/catalog";
import { parseProductListParams } from "@/lib/catalog/params";

export async function GET(request: Request, ctx: RouteContext<"/api/collections/[handle]">) {
  const { handle } = await ctx.params;
  const collection = await getCollectionByHandle(handle);
  if (!collection) return NextResponse.json({ error: "Collection not found" }, { status: 404 });

  const parsed = parseProductListParams(new URL(request.url).searchParams);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const products = await listProducts({ ...parsed.data, collection: handle });
  return NextResponse.json({ collection, products });
}
