import { NextResponse } from "next/server";
import { parseProductListParams } from "@/lib/catalog/params";
import { listProducts } from "@/lib/catalog";

export async function GET(request: Request) {
  const parsed = parseProductListParams(new URL(request.url).searchParams);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  return NextResponse.json(await listProducts(parsed.data));
}
