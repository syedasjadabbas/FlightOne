import type { OfferCard } from "@/lib/consultant/types";

/**
 * Travelport offer revalidation boundary.
 *
 * Today: search results are `search_only` — View Deal does NOT re-price against GDS.
 * Future: POST /suppliers/revalidate with bookingRefs → buildfromcatalogproductofferings.
 */

export type RevalidationResult =
  | {
      status: "available";
      offer: OfferCard;
      priceChanged: boolean;
      previousPriceMinor: number;
    }
  | {
      status: "unavailable";
      reason: string;
    }
  | {
      status: "not_implemented";
      message: string;
    };

export async function revalidateOfferBeforeDeal(
  offer: OfferCard,
): Promise<RevalidationResult> {
  void offer;
  return {
    status: "not_implemented",
    message:
      "GDS revalidation is not wired yet. Price and availability were captured at search time only.",
  };
}

export function isSearchOnlyFare(offer: OfferCard): boolean {
  return offer.flight?.validationStatus !== "revalidated";
}
