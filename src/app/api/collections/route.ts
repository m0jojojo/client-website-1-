import { connection, NextResponse } from "next/server";
import { listCollections } from "@/lib/catalog";

export async function GET() {
  // Opt out of prerendering: this route reads live database data on every request.
  await connection();
  return NextResponse.json({ items: await listCollections() });
}
