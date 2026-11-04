import { z } from "zod";
import { INDIAN_STATES } from "./states";

/** Accepts "98765 43210", "+91-98765-43210", "09876543210"; returns the 10 digits or the input unchanged. */
export function normalizePhone(raw: string): string {
  let d = raw.replace(/[\s\-().]/g, "");
  if (d.startsWith("+91")) d = d.slice(3);
  else if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d;
}

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

export const addressFields = {
  fullName: z
    .string()
    .trim()
    .min(2, "Enter the recipient's full name")
    .max(80, "That name is too long"),
  phone: z
    .string()
    .transform(normalizePhone)
    .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number")),
  line1: z.string().trim().min(3, "Enter the house number and street").max(120, "That is too long"),
  line2: z.preprocess(blankToUndefined, z.string().trim().max(120, "That is too long").optional()),
  landmark: z.preprocess(
    blankToUndefined,
    z.string().trim().max(80, "That is too long").optional(),
  ),
  city: z.string().trim().min(2, "Enter the city").max(60, "That is too long"),
  state: z.enum(INDIAN_STATES, { message: "Choose a state" }),
  pincode: z
    .string()
    .trim()
    .regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit PIN code"),
  isDefault: z.boolean().optional(),
};

export const addressInput = z.object(addressFields).strict();
export const addressPatch = z.object(addressFields).partial().strict();

export type AddressInput = z.infer<typeof addressInput>;
export type AddressPatch = z.infer<typeof addressPatch>;

export type AddressView = {
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
};
