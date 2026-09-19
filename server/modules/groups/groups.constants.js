/**
 * Module 11 — Group Travel domain constants.
 */

export const GROUP_TYPES = [
  "CORPORATE_TOUR",
  "STUDENT",
  "UMRAH_HAJJ",
  "LEISURE",
  "SPORTS",
  "FAMILY",
  "OTHER",
];

export const GROUP_MEMBER_ROLES = ["ORGANIZER", "ADMIN", "MEMBER"];

/** Roles that may manage invitations, attendance overrides, etc. */
export const ORGANIZER_ROLES = ["ORGANIZER", "ADMIN"];

export const GROUP_MEMBER_STATUSES = ["ACTIVE", "INVITED", "LEFT"];

export const ATTENDANCE_STATUSES = ["PRESENT", "ABSENT", "EXCUSED"];

/** SDS / product rule: group fare enquiries start at 10 travellers. */
export const MIN_GROUP_PASSENGERS = 10;
export const MAX_GROUP_PASSENGERS = 500;

export const GROUP_REQUEST_STATUSES = ["SUBMITTED", "IN_REVIEW", "CANCELLED"];

export const GROUP_DATE_FLEXIBILITY = ["EXACT", "PLUS_MINUS_1", "PLUS_MINUS_3", "FLEXIBLE_WEEK"];

export const GROUP_CABIN_PREFERENCES = ["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"];
