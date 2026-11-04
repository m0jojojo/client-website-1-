import { NextResponse } from "next/server";
import { getProductByHandle } from "@/lib/catalog";

export async function GET(_request: Request, ctx: RouteContext<"/api/products/[handle]">) {
  const { handle } = await ctx.params;
  const product = await getProductByHandle(handle);
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  return NextResponse.json(product);
}
