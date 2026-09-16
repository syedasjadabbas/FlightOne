export class AppError extends Error {
  constructor(statusCode, message, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.name = "AppError";
    /** Optional machine-readable code (e.g. SUPPLIER_BOOKING_UNCONFIGURED). */
    this.code = undefined;
    /** Optional structured details for clients. */
    this.details = undefined;
  }
}
