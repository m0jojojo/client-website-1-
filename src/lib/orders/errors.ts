export type CheckoutErrorCode =
  | "EMPTY_CART"
  | "ITEMS_UNAVAILABLE"
  | "ADDRESS_NOT_FOUND"
  | "PAYMENT_UNAVAILABLE"
  | "FORBIDDEN"
  | "ORDER_NOT_FOUND"
  | "INVALID_PAYMENT";

export class CheckoutError extends Error {
  constructor(
    public code: CheckoutErrorCode,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "CheckoutError";
  }
}
