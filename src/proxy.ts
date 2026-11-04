import { NextResponse, type NextRequest } from "next/server";
import { handleExists, type HandleKind } from "@/lib/catalog/handles";

// Product and collection pages stream their content, which fixes the HTTP status at 200 even for
// names that do not exist. Checking the name here, before the page renders, lets search engines
// receive a genuine 404 for those addresses.
export const config = { matcher: ["/products/:handle", "/collections/:handle"] };

export async function proxy(request: NextRequest) {
  const match = /^\/(products|collections)\/([^/]+)\/?$/.exec(request.nextUrl.pathname);
  if (!match) return NextResponse.next();

  const kind = match[1] as HandleKind;
  let handle: string;
  try {
    handle = decodeURIComponent(match[2]);
  } catch {
    return notFound(request);
  }
  if (kind === "collections" && handle === "all") return NextResponse.next(); // the whole-catalog page

  return (await handleExists(kind, handle)) ? NextResponse.next() : notFound(request);
}

/** An address that matches no route makes Next.js answer with its not-found page and a 404 status. */
function notFound(request: NextRequest) {
  return NextResponse.rewrite(new URL("/_missing", request.url));
}
