import { successResponse } from "../../lib/response.js";
import * as pricingService from "./pricing.service.js";

/**
 * Resolve agent discount authority server-side from `req.permissions`.
 * Never trust a client-supplied agentDiscountMaxBps / tier claim.
 */
async function agentDiscountAuthorityFromReq(req, requestedDiscountBps) {
  if (!requestedDiscountBps) return {};
  const agentDiscountMaxBps = await pricingService.resolveAgentDiscountMaxBps(req.permissions);
  return { agentDiscountMaxBps };
}

/** GET/POST /api/v1/pricing/quote — price a net fare for the search/quote UI. */
export async function quote(req, res, next) {
  try {
    const input = req.method === "GET" ? req.query : req.body;
    const authority = await agentDiscountAuthorityFromReq(req, input.requestedDiscountBps);
    const data = await pricingService.priceOffer({ ...input, ...authority });
    return successResponse(res, "Priced", data);
  } catch (e) {
    next(e);
  }
}

/** POST /api/v1/pricing/reprice — booking revalidation (quote/reserve/pay). */
export async function reprice(req, res, next) {
  try {
    const authority = await agentDiscountAuthorityFromReq(req, req.body?.requestedDiscountBps);
    const data = await pricingService.priceOffer({ ...req.body, ...authority });
    return successResponse(res, "Repriced", data);
  } catch (e) {
    next(e);
  }
}
