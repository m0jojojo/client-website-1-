export type CartLine = {
  id: string;
  variantId: string;
  handle: string;
  title: string;
  /** null when the product has only the default variant */
  variantTitle: string | null;
  pricePaise: number;
  compareAtPricePaise: number | null;
  quantity: number;
  lineTotalPaise: number;
  /** false when the variant has sold out since it was added */
  available: boolean;
  imageUrl: string;
  imageAlt: string;
};

export type CartView = {
  lines: CartLine[];
  /** Total units of available lines (what the header badge shows). */
  itemCount: number;
  /** Sum of available lines at current database prices, in paise. */
  subtotalPaise: number;
  /** What the customer saves versus regular prices, in paise. */
  savingsPaise: number;
};

export const EMPTY_CART: CartView = { lines: [], itemCount: 0, subtotalPaise: 0, savingsPaise: 0 };

export type CartErrorCode = "VARIANT_NOT_FOUND" | "SOLD_OUT" | "CART_FULL" | "ITEM_NOT_FOUND";

export class CartError extends Error {
  constructor(
    public code: CartErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CartError";
  }
}
