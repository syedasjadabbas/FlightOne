export class AppError extends Error {
  /**
   * @param {number} statusCode
   * @param {string} message
   * @param {boolean | Record<string, unknown>} [isOperationalOrDetails=true]
   *   Pass `false` for unexpected failures, or a plain object of client `details`.
   */
  constructor(statusCode, message, isOperationalOrDetails = true) {
    super(message);
    this.statusCode = statusCode;
    this.name = "AppError";
    /** Optional machine-readable code (e.g. SUPPLIER_BOOKING_UNCONFIGURED). */
    this.code = undefined;
    /** Optional structured details for clients. */
    this.details = undefined;

    if (
      isOperationalOrDetails &&
      typeof isOperationalOrDetails === "object" &&
      !Array.isArray(isOperationalOrDetails)
    ) {
      this.isOperational = true;
      this.details = isOperationalOrDetails;
      if (typeof isOperationalOrDetails.code === "string") {
        this.code = isOperationalOrDetails.code;
      }
    } else {
      this.isOperational = Boolean(isOperationalOrDetails);
    }
  }
}
