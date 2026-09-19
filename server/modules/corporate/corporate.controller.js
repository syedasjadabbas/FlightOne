import { successResponse } from "../../lib/response.js";
import * as corporateService from "./corporate.service.js";
import * as invoiceService from "./corporate.invoices.js";
import * as portalService from "./corporate.portal.js";
import * as expenseService from "./corporate.expenses.js";
import * as carbonService from "./corporate.carbon.js";
import * as advancedAnalytics from "../dashboard/dashboard.advanced.js";

export async function createCompany(req, res, next) {
  try {
    const data = await corporateService.createCompany(
      req.user.id,
      req.body,
      req.permissions,
    );
    return successResponse(res, "Company created", data, 201);
  } catch (e) {
    next(e);
  }
}

export async function listCompanies(req, res, next) {
  try {
    const data = await corporateService.listCompanies(req.user.id, req.permissions);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function getCompany(req, res, next) {
  try {
    const data = await corporateService.getCompanyForMember(req.user.id, req.params.id);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function updateCompany(req, res, next) {
  try {
    const data = await corporateService.updateCompany(
      req.user.id,
      req.params.id,
      req.body,
      req.permissions,
    );
    return successResponse(res, "Company updated", data);
  } catch (e) {
    next(e);
  }
}

export async function addMember(req, res, next) {
  try {
    const data = await corporateService.addMember(req.user.id, req.params.id, req.body);
    return successResponse(res, "Member added", data, 201);
  } catch (e) {
    next(e);
  }
}

export async function listMembers(req, res, next) {
  try {
    const data = await corporateService.listMembers(req.user.id, req.params.id);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function updateMember(req, res, next) {
  try {
    const data = await corporateService.updateMember(
      req.user.id,
      req.params.id,
      req.params.userId,
      req.body,
    );
    return successResponse(res, "Member updated", data);
  } catch (e) {
    next(e);
  }
}

export async function removeMember(req, res, next) {
  try {
    const data = await corporateService.removeMember(
      req.user.id,
      req.params.id,
      req.params.userId,
    );
    return successResponse(res, "Member removed", data);
  } catch (e) {
    next(e);
  }
}

export async function createPolicy(req, res, next) {
  try {
    const data = await corporateService.createPolicy(req.user.id, req.params.id, req.body);
    return successResponse(res, "Policy created", data, 201);
  } catch (e) {
    next(e);
  }
}

export async function listPolicies(req, res, next) {
  try {
    const data = await corporateService.listPolicies(req.user.id, req.params.id);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function updatePolicy(req, res, next) {
  try {
    const data = await corporateService.updatePolicy(
      req.user.id,
      req.params.id,
      req.params.policyId,
      req.body,
    );
    return successResponse(res, "Policy updated", data);
  } catch (e) {
    next(e);
  }
}

export async function evaluatePolicy(req, res, next) {
  try {
    await corporateService.requireCompanyMembership(req.user.id, req.params.id);
    const data = await corporateService.evaluatePolicy({
      companyId: req.params.id,
      ...req.body,
    });
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function listCompanyBookings(req, res, next) {
  try {
    const data = await corporateService.listCompanyBookings(
      req.user.id,
      req.params.id,
      req.query,
    );
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function getBookingApprovalGate(req, res, next) {
  try {
    const data = await corporateService.getBookingApprovalGate(
      req.user.id,
      req.params.bookingId,
    );
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function createApproval(req, res, next) {
  try {
    const data = await corporateService.createApprovalRequest(req.user.id, req.body);
    return successResponse(res, "Approval request created", data, 201);
  } catch (e) {
    next(e);
  }
}

export async function listApprovals(req, res, next) {
  try {
    const data = await corporateService.listApprovals(req.user.id, req.query, req.permissions);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function decideApproval(req, res, next) {
  try {
    const data = await corporateService.decideApproval(req.user.id, req.params.id, req.body);
    return successResponse(res, "Decision recorded", data);
  } catch (e) {
    next(e);
  }
}

export async function listCompanyAudit(req, res, next) {
  try {
    const data = await corporateService.listCompanyAudit(req.user.id, req.params.id, req.query);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function listProjectCodes(req, res, next) {
  try {
    const data = await corporateService.listProjectCodes(req.user.id, req.params.id, req.query);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function createProjectCode(req, res, next) {
  try {
    const data = await corporateService.createProjectCode(req.user.id, req.params.id, req.body);
    return successResponse(res, "Project code created", data, 201);
  } catch (e) {
    next(e);
  }
}

export async function updateProjectCode(req, res, next) {
  try {
    const data = await corporateService.updateProjectCode(
      req.user.id,
      req.params.id,
      req.params.projectCodeId,
      req.body,
    );
    return successResponse(res, "Project code updated", data);
  } catch (e) {
    next(e);
  }
}

export async function setBookingProjectCode(req, res, next) {
  try {
    const data = await corporateService.setBookingProjectCode(
      req.user.id,
      req.params.bookingId,
      req.body.projectCodeId,
    );
    return successResponse(res, "Project code attached", data);
  } catch (e) {
    next(e);
  }
}

export async function listInvoices(req, res, next) {
  try {
    const data = await invoiceService.listInvoices(req.user.id, req.params.id, req.query);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function issueInvoice(req, res, next) {
  try {
    const data = await invoiceService.issueInvoice(req.user.id, req.params.id, req.body);
    return successResponse(res, "Invoice issued", data, 201);
  } catch (e) {
    next(e);
  }
}

export async function getInvoice(req, res, next) {
  try {
    const data = await invoiceService.getInvoice(
      req.user.id,
      req.params.id,
      req.params.invoiceId,
    );
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function getInvoicePdf(req, res, next) {
  try {
    const data = await invoiceService.getInvoicePdf(
      req.user.id,
      req.params.id,
      req.params.invoiceId,
    );
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function updateInvoiceStatus(req, res, next) {
  try {
    const data = await invoiceService.updateInvoiceStatus(
      req.user.id,
      req.params.id,
      req.params.invoiceId,
      req.body,
    );
    return successResponse(res, "Invoice updated", data);
  } catch (e) {
    next(e);
  }
}

/**
 * Server-validated Personal ↔ Corporate profile context.
 * Guests cannot reach this route (requireAuth on the router).
 */
export async function activeProfile(req, res, next) {
  try {
    const rawMode = req.header("X-FlightOne-Profile") || req.query.mode || "PERSONAL";
    const companyId = req.query.companyId || req.header("X-FlightOne-Company-Id") || undefined;
    const data = await corporateService.resolveActiveProfile(req.user.id, {
      mode: rawMode,
      companyId: companyId ? String(companyId) : undefined,
    });
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function resolvePublicPortal(req, res, next) {
  try {
    const data = await portalService.resolvePublicPortal(req.query.host);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function getCompanyPortal(req, res, next) {
  try {
    const data = await portalService.getCompanyPortal(req.user.id, req.params.id);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function updateCompanyBranding(req, res, next) {
  try {
    const data = await portalService.updateCompanyBranding(req.user.id, req.params.id, req.body);
    return successResponse(res, "Branding updated", data);
  } catch (e) {
    next(e);
  }
}

export async function configureCustomDomain(req, res, next) {
  try {
    const data = await portalService.configureCustomDomain(req.user.id, req.params.id, req.body);
    return successResponse(res, "Domain saved", data);
  } catch (e) {
    next(e);
  }
}

export async function verifyCustomDomain(req, res, next) {
  try {
    const data = await portalService.verifyCustomDomain(req.user.id, req.params.id);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function updateCompanySso(req, res, next) {
  try {
    const data = await portalService.updateCompanySso(req.user.id, req.params.id, req.body);
    return successResponse(res, "SSO configuration updated", data);
  } catch (e) {
    next(e);
  }
}

export async function startCompanySso(req, res, next) {
  try {
    const data = await portalService.startCompanySso(req.user.id, req.params.id);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function listExpenses(req, res, next) {
  try {
    const data = await expenseService.listExpenses(req.user.id, req.params.id, req.query);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function createExpense(req, res, next) {
  try {
    const data = await expenseService.createExpense(req.user.id, req.params.id, req.body);
    return successResponse(res, "Expense created", data, 201);
  } catch (e) {
    next(e);
  }
}

export async function getExpense(req, res, next) {
  try {
    const data = await expenseService.getExpense(req.user.id, req.params.id, req.params.expenseId);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function updateExpense(req, res, next) {
  try {
    const data = await expenseService.updateExpense(
      req.user.id,
      req.params.id,
      req.params.expenseId,
      req.body,
    );
    return successResponse(res, "Expense updated", data);
  } catch (e) {
    next(e);
  }
}

export async function attachExpenseReceipt(req, res, next) {
  try {
    const data = await expenseService.attachReceipt(
      req.user.id,
      req.params.id,
      req.params.expenseId,
      req.body,
    );
    return successResponse(res, "Receipt recorded", data);
  } catch (e) {
    next(e);
  }
}

export async function downloadExpenseReceipt(req, res, next) {
  try {
    const data = await expenseService.downloadReceipt(
      req.user.id,
      req.params.id,
      req.params.expenseId,
    );
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function submitExpense(req, res, next) {
  try {
    const data = await expenseService.submitExpense(
      req.user.id,
      req.params.id,
      req.params.expenseId,
    );
    return successResponse(res, "Expense submitted", data);
  } catch (e) {
    next(e);
  }
}

export async function decideExpense(req, res, next) {
  try {
    const data = await expenseService.decideExpense(
      req.user.id,
      req.params.id,
      req.params.expenseId,
      req.body,
    );
    return successResponse(res, "Decision recorded", data);
  } catch (e) {
    next(e);
  }
}

export async function reimburseExpense(req, res, next) {
  try {
    const data = await expenseService.markExpenseReimbursed(
      req.user.id,
      req.params.id,
      req.params.expenseId,
    );
    return successResponse(res, "Expense reimbursed", data);
  } catch (e) {
    next(e);
  }
}

export async function exportExpenses(req, res, next) {
  try {
    const data = await expenseService.exportReimbursableExpenses(req.user.id, req.params.id);
    return successResponse(res, "Export generated", data);
  } catch (e) {
    next(e);
  }
}

export async function listPerDiemPolicies(req, res, next) {
  try {
    const data = await expenseService.listPerDiemPolicies(req.user.id, req.params.id);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function upsertPerDiemPolicy(req, res, next) {
  try {
    const data = await expenseService.upsertPerDiemPolicy(req.user.id, req.params.id, req.body);
    return successResponse(res, "Per-diem policy saved", data);
  } catch (e) {
    next(e);
  }
}

export async function quotePerDiem(req, res, next) {
  try {
    const data = await expenseService.quotePerDiem(req.user.id, req.params.id, req.query);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function getCarbonDashboard(req, res, next) {
  try {
    const data = await carbonService.getCarbonDashboard(req.user.id, req.params.id, req.query);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function getCarbonNudges(req, res, next) {
  try {
    const data = await carbonService.getCarbonNudges(req.user.id, req.params.id);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function getCompanyAnalytics(req, res, next) {
  try {
    const data = await advancedAnalytics.getCompanyAdvancedAnalytics(
      req.user.id,
      req.params.id,
      req.query,
    );
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}
