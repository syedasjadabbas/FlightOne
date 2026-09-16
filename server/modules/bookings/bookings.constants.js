/**
 * Module 03 — Booking engine domain constants.
 */

export const BOOKING_PRODUCTS = ["FLIGHT", "HOTEL", "PACKAGE"];

export const BOOKING_STATUSES = [
  "QUOTED",
  "RESERVED",
  "TICKETED",
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
];

/** Allowed transitions — single source of truth for the state machine. */
export const BOOKING_ALLOWED_TRANSITIONS = Object.freeze({
  QUOTED: ["RESERVED", "CANCELLED"],
  RESERVED: ["TICKETED", "CANCELLED"],
  TICKETED: ["ACTIVE", "CANCELLED", "REFUNDED"],
  ACTIVE: ["COMPLETED", "CANCELLED", "REFUNDED"],
  COMPLETED: [],
  CANCELLED: [],
  REFUNDED: [],
});
