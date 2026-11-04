import { z } from "zod";
import { addressFields } from "@/lib/account/address-schema";

const shippingAddress = z
  .object({
    fullName: addressFields.fullName,
    phone: addressFields.phone,
    line1: addressFields.line1,
    line2: addressFields.line2,
    landmark: addressFields.landmark,
    city: addressFields.city,
    state: addressFields.state,
    pincode: addressFields.pincode,
  })
  .strict();

/**
 * What the browser may send to place an order. There is deliberately no price, total, discount
 * or product field: the server works all of that out from its own cart and catalog.
 */
export const checkoutInput = z
  .object({
    idempotencyKey: z.string().uuid("Invalid request"),
    paymentMethod: z.enum(["RAZORPAY", "COD"], { message: "Choose how you want to pay" }),
    email: z.string().trim().toLowerCase().max(254).pipe(z.email("Enter a valid email address")),
    phone: addressFields.phone,
    /** Use one of the signed-in customer's saved addresses... */
    addressId: z.string().trim().min(1).max(64).optional(),
    /** ...or a new one. Exactly one of the two. */
    address: shippingAddress.optional(),
    saveAddress: z.boolean().optional(),
  })
  .strict()
  .refine((v) => !!v.addressId !== !!v.address, {
    message: "Choose a saved address or enter a new one",
    path: ["address"],
  });

export type CheckoutInput = z.infer<typeof checkoutInput>;

export const verifyInput = z
  .object({
    orderNumber: z.number().int().positive(),
    token: z.string().trim().max(128).optional(),
    razorpay_order_id: z.string().trim().min(1).max(100),
    razorpay_payment_id: z.string().trim().min(1).max(100),
    razorpay_signature: z.string().trim().min(1).max(200),
  })
  .strict();

export type OrderView = {
  orderNumber: number;
  label: string;
  status: "PENDING_PAYMENT" | "CONFIRMED" | "CANCELLED";
  paymentMethod: "RAZORPAY" | "COD";
  paymentStatus: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
  email: string;
  phone: string;
  createdAt: string;
  paidAt: string | null;
  failureReason: string | null;
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  totalPaise: number;
  address: {
    fullName: string;
    phone: string;
    line1: string;
    line2: string | null;
    landmark: string | null;
    city: string;
    state: string;
    pincode: string;
  };
  items: {
    handle: string;
    title: string;
    variantTitle: string | null;
    imageUrl: string;
    unitPricePaise: number;
    compareAtPricePaise: number | null;
    quantity: number;
    lineTotalPaise: number;
  }[];
};
