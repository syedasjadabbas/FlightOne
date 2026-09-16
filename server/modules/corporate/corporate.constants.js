/**
 * Module 06 — Corporate Travel domain constants.
 * Single source for roles / approval statuses / decisions (validators + service).
 */

export const COMPANY_MEMBERSHIP_ROLES = ["MEMBER", "APPROVER", "ADMIN"];

export const APPROVAL_STATUSES = ["PENDING", "APPROVED", "REJECTED", "CHANGES_REQUESTED"];

export const APPROVAL_DECISIONS = ["APPROVE", "REJECT", "CHANGES_REQUESTED"];

/** Maps ApprovalDecision → ApprovalRequest.status */
export const DECISION_TO_STATUS = Object.freeze({
  APPROVE: "APPROVED",
  REJECT: "REJECTED",
  CHANGES_REQUESTED: "CHANGES_REQUESTED",
});

export const CORPORATE_FINANCE_PERMISSION = "corporate:company:write";

/** Max length for project code identifier (company-scoped). */
export const PROJECT_CODE_MAX_LEN = 40;

/** Max length for project code display name. */
export const PROJECT_CODE_NAME_MAX_LEN = 200;

/** Corporate invoice lifecycle (PRD Module 6 — minimal). */
export const CORPORATE_INVOICE_STATUSES = ["ISSUED", "PAID", "VOID"];

/** Booking statuses eligible for corporate invoice issuance. */
export const INVOICEABLE_BOOKING_STATUSES = [
  "RESERVED",
  "TICKETED",
  "ACTIVE",
  "COMPLETED",
];
