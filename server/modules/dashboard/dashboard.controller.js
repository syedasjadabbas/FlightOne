import { successResponse } from "../../lib/response.js";
import * as dashboardService from "./dashboard.service.js";

export async function overview(req, res, next) {
  try {
    const data = await dashboardService.getOverview(req.query);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function sales(req, res, next) {
  try {
    const data = await dashboardService.getSales(req.query);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function revenue(req, res, next) {
  try {
    const data = await dashboardService.getRevenue(req.query);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function margins(req, res, next) {
  try {
    const data = await dashboardService.getMargins(req.query);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function credit(_req, res, next) {
  try {
    const data = await dashboardService.getOutstandingCredit();
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function funnel(req, res, next) {
  try {
    const data = await dashboardService.getFunnel(req.query);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function conversion(req, res, next) {
  try {
    const data = await dashboardService.getBookingConversion(req.query);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function automation(req, res, next) {
  try {
    const data = await dashboardService.getAutomation(req.query);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function suppliers(req, res, next) {
  try {
    const data = await dashboardService.getSupplierPerformance(req.query);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function customers(req, res, next) {
  try {
    const data = await dashboardService.getCustomerAnalytics(req.query);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function operational(req, res, next) {
  try {
    const data = await dashboardService.getOperationalKpis(req.query);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function escalationsBreakdown(req, res, next) {
  try {
    const data = await dashboardService.getEscalationsBreakdown(req.query);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function avaGuidance(req, res, next) {
  try {
    const data = await dashboardService.buildAvaDashboardGuidance(req.query);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}
