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
