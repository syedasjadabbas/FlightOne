import { Router } from "express";
import { validateBody, validateParams, validateQuery } from "../../lib/validate.js";
import { requireAuth } from "../../middlewares/auth.js";
import * as corporateController from "./corporate.controller.js";
import {
  addMemberSchema,
  approvalIdParamsSchema,
  bookingIdParamsSchema,
  companyIdParamsSchema,
  createApprovalSchema,
  createCompanySchema,
  createPolicySchema,
  decideApprovalSchema,
  evaluatePolicySchema,
  listApprovalsQuerySchema,
  listAuditQuerySchema,
  listBookingsQuerySchema,
  listProjectCodesQuerySchema,
  memberUserParamsSchema,
  policyIdParamsSchema,
  projectCodeIdParamsSchema,
  setBookingProjectCodeSchema,
  updateCompanySchema,
  updateMemberSchema,
  updatePolicySchema,
  updateProjectCodeSchema,
  createProjectCodeSchema,
  invoiceIdParamsSchema,
  issueInvoiceSchema,
  listInvoicesQuerySchema,
  updateInvoiceStatusSchema,
} from "./corporate.validators.js";

const router = Router();

// Guests cannot access any corporate functionality.
router.use(requireAuth);

router.get("/me/active-profile", corporateController.activeProfile);

router.post("/companies", validateBody(createCompanySchema), corporateController.createCompany);
router.get("/companies", corporateController.listCompanies);
router.get(
  "/companies/:id",
  validateParams(companyIdParamsSchema),
  corporateController.getCompany,
);
router.patch(
  "/companies/:id",
  validateParams(companyIdParamsSchema),
  validateBody(updateCompanySchema),
  corporateController.updateCompany,
);

router.post(
  "/companies/:id/members",
  validateParams(companyIdParamsSchema),
  validateBody(addMemberSchema),
  corporateController.addMember,
);
router.get(
  "/companies/:id/members",
  validateParams(companyIdParamsSchema),
  corporateController.listMembers,
);
router.patch(
  "/companies/:id/members/:userId",
  validateParams(memberUserParamsSchema),
  validateBody(updateMemberSchema),
  corporateController.updateMember,
);
router.delete(
  "/companies/:id/members/:userId",
  validateParams(memberUserParamsSchema),
  corporateController.removeMember,
);

router.post(
  "/companies/:id/policies",
  validateParams(companyIdParamsSchema),
  validateBody(createPolicySchema),
  corporateController.createPolicy,
);
router.get(
  "/companies/:id/policies",
  validateParams(companyIdParamsSchema),
  corporateController.listPolicies,
);
router.patch(
  "/companies/:id/policies/:policyId",
  validateParams(policyIdParamsSchema),
  validateBody(updatePolicySchema),
  corporateController.updatePolicy,
);
router.post(
  "/companies/:id/evaluate-policy",
  validateParams(companyIdParamsSchema),
  validateBody(evaluatePolicySchema),
  corporateController.evaluatePolicy,
);

router.get(
  "/companies/:id/project-codes",
  validateParams(companyIdParamsSchema),
  validateQuery(listProjectCodesQuerySchema),
  corporateController.listProjectCodes,
);
router.post(
  "/companies/:id/project-codes",
  validateParams(companyIdParamsSchema),
  validateBody(createProjectCodeSchema),
  corporateController.createProjectCode,
);
router.patch(
  "/companies/:id/project-codes/:projectCodeId",
  validateParams(projectCodeIdParamsSchema),
  validateBody(updateProjectCodeSchema),
  corporateController.updateProjectCode,
);

router.patch(
  "/bookings/:bookingId/project-code",
  validateParams(bookingIdParamsSchema),
  validateBody(setBookingProjectCodeSchema),
  corporateController.setBookingProjectCode,
);

router.get(
  "/companies/:id/invoices",
  validateParams(companyIdParamsSchema),
  validateQuery(listInvoicesQuerySchema),
  corporateController.listInvoices,
);
router.post(
  "/companies/:id/invoices",
  validateParams(companyIdParamsSchema),
  validateBody(issueInvoiceSchema),
  corporateController.issueInvoice,
);
router.get(
  "/companies/:id/invoices/:invoiceId",
  validateParams(invoiceIdParamsSchema),
  corporateController.getInvoice,
);
router.get(
  "/companies/:id/invoices/:invoiceId/pdf",
  validateParams(invoiceIdParamsSchema),
  corporateController.getInvoicePdf,
);
router.patch(
  "/companies/:id/invoices/:invoiceId",
  validateParams(invoiceIdParamsSchema),
  validateBody(updateInvoiceStatusSchema),
  corporateController.updateInvoiceStatus,
);

router.get(
  "/companies/:id/bookings",
  validateParams(companyIdParamsSchema),
  validateQuery(listBookingsQuerySchema),
  corporateController.listCompanyBookings,
);

router.get(
  "/companies/:id/audit",
  validateParams(companyIdParamsSchema),
  validateQuery(listAuditQuerySchema),
  corporateController.listCompanyAudit,
);

router.get(
  "/bookings/:bookingId/approval-gate",
  validateParams(bookingIdParamsSchema),
  corporateController.getBookingApprovalGate,
);

router.post("/approvals", validateBody(createApprovalSchema), corporateController.createApproval);
router.get(
  "/approvals",
  validateQuery(listApprovalsQuerySchema),
  corporateController.listApprovals,
);
router.post(
  "/approvals/:id/decide",
  validateParams(approvalIdParamsSchema),
  validateBody(decideApprovalSchema),
  corporateController.decideApproval,
);

export default router;
