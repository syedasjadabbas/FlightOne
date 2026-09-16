/**
 * Quote payload from a selected offer. Snapshot id is required — never quote
 * from a client price or a synthetic (hub-stitched / seed) offer.
 */

export type QuoteableOffer = {
  supplierOfferSnapshotId?: string | null;
  type?: string;
  currency?: string;
  priceMinor?: number;
  flight?: {
    originCode?: string;
    destinationCode?: string;
    cabin?: string;
  } | null;
  originCode?: string;
  destinationCode?: string;
  cabin?: string;
};

export type QuoteCorporateContext = {
  companyId?: string | null;
  projectCodeId?: string | null;
};

export type ServerQuoteRequest = {
  product: "FLIGHT" | "HOTEL" | "PACKAGE";
  currency: string;
  supplierOfferSnapshotId: string;
  route?: string;
  cabin?: string;
  metadata?: {
    companyId?: string;
    projectCodeId?: string;
  };
};

export function offerHasQuoteSnapshot(offer: QuoteableOffer): boolean {
  return Boolean(offer.supplierOfferSnapshotId?.trim());
}

export function quotePayloadFromOffer(
  offer: QuoteableOffer,
  corporate?: QuoteCorporateContext,
): ServerQuoteRequest {
  const supplierOfferSnapshotId = offer.supplierOfferSnapshotId?.trim();
  if (!supplierOfferSnapshotId) {
    throw new Error("Cannot create a quote without a supplier offer snapshot");
  }

  const product =
    offer.type === "hotel" ? "HOTEL" : offer.type === "package" ? "PACKAGE" : "FLIGHT";
  const origin = offer.flight?.originCode || offer.originCode;
  const destination = offer.flight?.destinationCode || offer.destinationCode;
  const cabin = offer.flight?.cabin || offer.cabin;
  const route =
    origin && destination ? `${origin}-${destination}`.toUpperCase() : undefined;

  const companyId = corporate?.companyId?.trim() || undefined;
  const projectCodeId = corporate?.projectCodeId?.trim() || undefined;
  const metadata: { companyId?: string; projectCodeId?: string } = {};
  if (companyId) metadata.companyId = companyId;
  if (projectCodeId && companyId) metadata.projectCodeId = projectCodeId;

  return {
    product,
    currency: (offer.currency || "USD").toUpperCase().slice(0, 3),
    supplierOfferSnapshotId,
    ...(route ? { route } : {}),
    ...(cabin ? { cabin: String(cabin).toUpperCase() } : {}),
    ...(Object.keys(metadata).length ? { metadata } : {}),
  };
}
