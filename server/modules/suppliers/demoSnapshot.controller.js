import { successResponse } from "../../lib/response.js";
import { AppError } from "../../lib/customError.js";
import { persistOfferSnapshot } from "./suppliers.service.js";

/**
 * Mints a real SupplierOfferSnapshot for a demo-corpus offer so the booking
 * engine can quote it like any supplier fare.
 *
 * WHY this exists: snapshots are DB rows scoped to a user, not free-form
 * strings. The demo corpus ships a `snap_demo_*` id that no row matches, so
 * `bookings.service` rejected every demo checkout with 409 "Invalid supplier
 * offer reference". Minting a genuine row keeps the booking engine's
 * never-trust-the-client contract intact instead of weakening it for demos.
 *
 * Gated on DEMO_FLIGHT_INVENTORY: without it this endpoint would let any
 * authenticated caller invent a fare at a price of their choosing.
 */
function assertDemoEnabled() {
  if (process.env.DEMO_FLIGHT_INVENTORY !== "true") {
    throw new AppError(404, "Not found");
  }
}

export async function createDemoSnapshot(req, res, next) {
  try {
    assertDemoEnabled();

    // Snapshot owner is always the authenticated subject — never the body.
    const userId = req.user?.id;
    if (!userId || userId === "internal") {
      throw new AppError(401, "Authentication required");
    }

    const { offerId, currency, netMinor, product, itinerary } = req.body;

    const snapshot = await persistOfferSnapshot({
      userId,
      offer: {
        supplierCode: "GALILEO_DEMO",
        offerId,
        product,
        currency,
        amountMinor: netMinor,
        details: {
          ...(itinerary ?? {}),
          contentSource: "DEMO_CORPUS",
        },
        fareRules: { refundable: false },
      },
    });

    return successResponse(res, "OK", {
      supplierOfferSnapshotId: snapshot.id,
      expiresAt: snapshot.expiresAt,
    });
  } catch (e) {
    next(e);
  }
}
