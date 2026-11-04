export type AccountErrorCode = "NOT_FOUND" | "LIMIT_REACHED";

export class AccountError extends Error {
  constructor(
    public code: AccountErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AccountError";
  }
}
