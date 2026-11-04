import { addressInput } from "@/lib/account/address-schema";
import { createAddress, listAddresses } from "@/lib/account/addresses";
import { errorResponse, isSameOrigin, json, readJson, requireUser } from "@/lib/account/http";

export async function GET() {
  const user = await requireUser();
  if (user instanceof Response) return user;
  try {
    return json({ items: await listAddresses(user.id) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return json({ error: "Forbidden" }, 403);
  const user = await requireUser();
  if (user instanceof Response) return user;
  try {
    const input = addressInput.parse(await readJson(request));
    await createAddress(user.id, input);
    return json({ items: await listAddresses(user.id) }, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
