import { getDb } from "@/lib/db";
import type { AddressInput, AddressPatch, AddressView } from "./address-schema";
import { AccountError } from "./errors";

export const MAX_ADDRESSES = 10;

const toView = (a: {
  id: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}): AddressView => ({
  id: a.id,
  fullName: a.fullName,
  phone: a.phone,
  line1: a.line1,
  line2: a.line2,
  landmark: a.landmark,
  city: a.city,
  state: a.state,
  pincode: a.pincode,
  isDefault: a.isDefault,
});

/** The default address first, then newest first. */
export async function listAddresses(userId: string): Promise<AddressView[]> {
  const rows = await getDb().address.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(toView);
}

export async function createAddress(userId: string, input: AddressInput): Promise<AddressView> {
  const db = getDb();
  const count = await db.address.count({ where: { userId } });
  if (count >= MAX_ADDRESSES) {
    throw new AccountError("LIMIT_REACHED", `You can save up to ${MAX_ADDRESSES} addresses.`);
  }
  const makeDefault = input.isDefault === true || count === 0;
  const { isDefault: _ignored, ...fields } = input;
  void _ignored;

  if (makeDefault) {
    const [, created] = await db.$transaction([
      db.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } }),
      db.address.create({ data: { ...fields, userId, isDefault: true } }),
    ]);
    return toView(created);
  }
  return toView(await db.address.create({ data: { ...fields, userId, isDefault: false } }));
}

export async function updateAddress(
  userId: string,
  id: string,
  patch: AddressPatch,
): Promise<AddressView> {
  const db = getDb();
  const existing = await db.address.findFirst({ where: { id, userId } });
  if (!existing) throw new AccountError("NOT_FOUND", "That address was not found.");

  const { isDefault, ...fields } = patch;
  // A default address always exists: it can only be changed by choosing another one.
  const becomesDefault = isDefault === true && !existing.isDefault;
  if (becomesDefault) {
    const [, updated] = await db.$transaction([
      db.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } }),
      db.address.update({ where: { id }, data: { ...fields, isDefault: true } }),
    ]);
    return toView(updated);
  }
  return toView(await db.address.update({ where: { id }, data: fields }));
}

export async function deleteAddress(userId: string, id: string): Promise<void> {
  const db = getDb();
  const existing = await db.address.findFirst({ where: { id, userId } });
  if (!existing) throw new AccountError("NOT_FOUND", "That address was not found.");
  await db.address.delete({ where: { id } });
  if (existing.isDefault) {
    const next = await db.address.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
    if (next) await db.address.update({ where: { id: next.id }, data: { isDefault: true } });
  }
}
