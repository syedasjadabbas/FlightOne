import { successResponse } from "../../lib/response.js";
import * as bookingsService from "./bookings.service.js";

export async function create(req, res, next) {
  try {
    const data = await bookingsService.createQuote(req.user.id, req.body);
    return successResponse(res, "Quote created", data, 201);
  } catch (e) {
    next(e);
  }
}

export async function list(req, res, next) {
  try {
    const data = await bookingsService.listBookings(req.user.id, req.query);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function getById(req, res, next) {
  try {
    const data = await bookingsService.getBookingById(req.user.id, req.params.id);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function pay(req, res, next) {
  try {
    const data = await bookingsService.payBooking(req.user.id, req.params.id, req.body);
    return successResponse(res, "Payment recorded", data);
  } catch (e) {
    next(e);
  }
}

export async function reserve(req, res, next) {
  try {
    const forwarded = req.headers["x-forwarded-for"];
    const requestIp =
      (typeof forwarded === "string" ? forwarded.split(",")[0]?.trim() : null) ||
      req.ip ||
      req.socket?.remoteAddress ||
      null;
    const data = await bookingsService.reserveBooking(req.user.id, req.params.id, {
      ...req.body,
      requestIp,
    });
    return successResponse(res, "Reserved", data);
  } catch (e) {
    next(e);
  }
}

export async function ticket(req, res, next) {
  try {
    const data = await bookingsService.ticketBooking(req.user.id, req.params.id, req.body);
    return successResponse(res, "Ticketed", data);
  } catch (e) {
    next(e);
  }
}

export async function acceptPrice(req, res, next) {
  try {
    const data = await bookingsService.acceptPriceChange(req.user.id, req.params.id, req.body);
    return successResponse(res, "Price accepted", data);
  } catch (e) {
    next(e);
  }
}

export async function cancel(req, res, next) {
  try {
    const data = await bookingsService.cancelBooking(req.user.id, req.params.id, req.body);
    return successResponse(res, "Cancelled", data);
  } catch (e) {
    next(e);
  }
}
