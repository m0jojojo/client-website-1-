import { errorResponse as accountErrorResponse, json } from "@/lib/account/http";
import { CheckoutError, type CheckoutErrorCode } from "./errors";

export { isSameOrigin, json, readJson } from "@/lib/account/http";

const STATUS: Record<CheckoutErrorCode, number> = {
  EMPTY_CART: 409,
  ITEMS_UNAVAILABLE: 409,
  ADDRESS_NOT_FOUND: 404,
  PAYMENT_UNAVAILABLE: 503,
  FORBIDDEN: 403,
  ORDER_NOT_FOUND: 404,
  INVALID_PAYMENT: 400,
};

export function errorResponse(err: unknown) {
  if (err instanceof CheckoutError) {
    return json({ error: err.message, code: err.code, details: err.details }, STATUS[err.code]);
  }
  return accountErrorResponse(err);
}
