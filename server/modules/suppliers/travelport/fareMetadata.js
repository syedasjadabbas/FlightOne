/**
 * Extract fare-family, baggage, penalties, and price breakdown from Travelport
 * Search ReferenceList + ProductBrandOffering. Only surfaces data present in GDS.
 */

/**
 * @param {unknown} major
 * @param {number} [_decimalPlace]
 */
export function priceToMinor(major, _decimalPlace = 2) {
  const n = typeof major === "number" ? major : Number(major);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/**
 * @param {any} priceNode
 */
export function extractPriceBreakdown(priceNode) {
  if (!priceNode) return null;
  const currency =
    priceNode?.CurrencyCode?.value || priceNode?.CurrencyCode || "PKR";
  const decimals =
    typeof priceNode?.CurrencyCode?.decimalPlace === "number"
      ? priceNode.CurrencyCode.decimalPlace
      : 2;
  const baseMinor = priceToMinor(priceNode.Base, decimals);
  const taxesMinor = priceToMinor(priceNode.TotalTaxes, decimals);
  const feesMinor = priceToMinor(priceNode.TotalFees, decimals);
  const totalMinor = priceToMinor(priceNode.TotalPrice ?? priceNode.Total, decimals);
  if (totalMinor == null || totalMinor <= 0) return null;
  const hasParts =
    (baseMinor != null && baseMinor > 0) ||
    (taxesMinor != null && taxesMinor > 0) ||
    (feesMinor != null && feesMinor > 0);
  if (!hasParts) return { currency, totalMinor };
  const sum = (baseMinor ?? 0) + (taxesMinor ?? 0) + (feesMinor ?? 0);
  if (sum > 0 && Math.abs(sum - totalMinor) > 1) {
    return { currency, totalMinor };
  }
  return {
    currency,
    ...(baseMinor != null ? { baseMinor } : {}),
    ...(taxesMinor != null ? { taxesMinor } : {}),
    ...(feesMinor != null ? { feesMinor } : {}),
    totalMinor,
  };
}

/**
 * @param {any[]} referenceList
 */
export function indexFareReferenceLists(referenceList) {
  /** @type {Map<string, any>} */
  const brands = new Map();
  /** @type {Map<string, any>} */
  const terms = new Map();

  for (const block of referenceList || []) {
    const type = String(block?.["@type"] || "");
    if (type.includes("ReferenceListBrand") || block?.Brand) {
      for (const b of block.Brand || []) {
        if (b?.id) brands.set(b.id, b);
      }
    }
    if (type.includes("ReferenceListTerms") || block?.TermsAndConditions) {
      for (const t of block.TermsAndConditions || []) {
        if (t?.id) terms.set(t.id, t);
      }
    }
  }
  return { brands, terms };
}

/**
 * @param {any} brand
 */
export function brandAttributesByClassification(brand) {
  /** @type {Map<string, string>} */
  const map = new Map();
  for (const attr of [...(brand?.BrandAttribute || []), ...(brand?.AdditionalBrandAttribute || [])]) {
    const key = String(attr?.classification || attr?.Classification || "").trim();
    const inclusion = String(attr?.inclusion || attr?.Inclusion || "").trim();
    if (key && inclusion) map.set(key, inclusion);
  }
  return map;
}

/**
 * @param {string} inclusion
 */
function inclusionLabel(inclusion) {
  switch (inclusion) {
    case "Included":
      return "Included";
    case "Not Offered":
      return "Not permitted";
    case "Chargeable":
      return "Permitted (fee may apply)";
    default:
      return inclusion || null;
  }
}

/**
 * @param {any} product
 */
export function extractProductFareCodes(product) {
  const pf = product?.PassengerFlight?.[0];
  const fp = pf?.FlightProduct?.[0];
  if (!fp) return {};
  return {
    fareBasisCode: fp.fareBasisCode ? String(fp.fareBasisCode) : null,
    bookingClass: fp.classOfService ? String(fp.classOfService) : null,
    fareType: fp.fareType ? String(fp.fareType) : null,
    seatsAvailable:
      typeof product?.Quantity === "number" && product.Quantity > 0
        ? product.Quantity
        : null,
  };
}

/**
 * @param {any[]} penalties
 * @param {"Change"|"Cancel"} kind
 */
function formatPenaltyLine(penalties, kind) {
  const block = penalties?.find((p) => Array.isArray(p?.[kind]));
  const entry = block?.[kind]?.[0];
  if (!entry) return null;
  const pct = entry?.Penalty?.find((p) => p?.["@type"] === "PenaltyPercent")?.Percent;
  if (typeof pct === "number") {
    if (pct >= 100) return kind === "Cancel" ? "Non-refundable" : "Changes not permitted";
    return `${pct}% penalty may apply`;
  }
  const amount = entry?.Penalty?.find((p) => p?.Amount != null);
  if (amount?.Amount != null) {
    return `Fee may apply (${amount.Amount})`;
  }
  return kind === "Cancel" ? "Cancellation terms apply" : "Change terms apply";
}

/**
 * @param {any} termsNode
 * @param {string|null} productRef
 */
export function extractBaggageFromTerms(termsNode, productRef) {
  if (!termsNode?.BaggageAllowance?.length) return null;
  /** @type {Record<string, any>} */
  const out = {};

  for (const bag of termsNode.BaggageAllowance) {
    if (productRef && bag?.ProductRef?.length && !bag.ProductRef.includes(productRef)) {
      continue;
    }
    const type = String(bag.baggageType || "").toLowerCase();
    const item = bag?.BaggageItem?.[0];
    const included = String(item?.includedInOfferPrice || "").toLowerCase() === "yes";
    const weight = item?.Measurement?.find(
      (m) => String(m?.measurementType || "").toLowerCase() === "weight",
    );
    const weightKg =
      weight?.unit?.toLowerCase()?.startsWith("kil") && typeof weight.value === "number"
        ? weight.value
        : undefined;
    const pieces =
      typeof item?.quantity === "number"
        ? item.quantity
        : Array.isArray(bag.Text)
          ? Number.parseInt(String(bag.Text[0]).replace(/\D/g, ""), 10) || undefined
          : undefined;
    const text =
      item?.Text ||
      (Array.isArray(bag.Text) ? bag.Text.join(" ") : null) ||
      undefined;

    if (type.includes("carry")) {
      out.carryOn = { included, ...(pieces != null ? { pieces } : {}), ...(text ? { text } : {}) };
    } else if (type.includes("checked") || type.includes("firstchecked")) {
      out.checked = {
        included,
        ...(weightKg != null ? { weightKg } : {}),
        ...(pieces != null ? { pieces } : {}),
        ...(text ? { text } : {}),
      };
    }
  }
  return Object.keys(out).length ? out : null;
}

/**
 * @param {object} args
 */
export function buildFareMetadata({
  brandRef,
  productRef,
  product,
  brands,
  terms,
  termsRef,
  priceNode,
}) {
  const brand = brandRef ? brands.get(brandRef) : null;
  const termsNode = termsRef ? terms.get(termsRef) : null;
  const brandAttrs = brand ? brandAttributesByClassification(brand) : new Map();
  const productCodes = extractProductFareCodes(product);
  const priceBreakdown = extractPriceBreakdown(priceNode);

  const baggageFromTerms = termsNode
    ? extractBaggageFromTerms(termsNode, productRef)
    : null;

  /** @type {Record<string, any>} */
  const baggage = baggageFromTerms ? { ...baggageFromTerms } : {};

  const carryBrand = brandAttrs.get("CarryOn");
  if (!baggage.carryOn && carryBrand) {
    baggage.carryOn = {
      included: carryBrand === "Included",
      text: inclusionLabel(carryBrand),
    };
  }
  const checkedBrand = brandAttrs.get("CheckedBag");
  if (!baggage.checked && checkedBrand) {
    baggage.checked = {
      included: checkedBrand === "Included",
      text: inclusionLabel(checkedBrand),
    };
  }

  const changesFromPenalty = termsNode?.Penalties
    ? formatPenaltyLine(termsNode.Penalties, "Change")
    : null;
  const cancelFromPenalty = termsNode?.Penalties
    ? formatPenaltyLine(termsNode.Penalties, "Cancel")
    : null;

  const changesFromBrand = brandAttrs.get("Rebooking")
    ? inclusionLabel(brandAttrs.get("Rebooking"))
    : null;
  const refundFromBrand = brandAttrs.get("Refund")
    ? inclusionLabel(brandAttrs.get("Refund"))
    : null;

  const changes = changesFromPenalty || (changesFromBrand ? `Changes: ${changesFromBrand}` : null);
  const cancellation =
    cancelFromPenalty ||
    (refundFromBrand === "Not permitted" ? "Non-refundable" : null);
  const refund =
    cancelFromPenalty ||
    (refundFromBrand ? `Refund: ${refundFromBrand}` : null);

  let refundable;
  if (cancelFromPenalty === "Non-refundable" || refundFromBrand === "Not permitted") {
    refundable = false;
  } else if (refundFromBrand === "Included") {
    refundable = true;
  }

  const validatingCarrier =
    termsNode?.ValidatingAirline?.[0]?.ValidatingAirline ||
    termsNode?.ValidatingAirline?.[0]?.validatingAirline ||
    null;

  const paymentTimeLimit = termsNode?.PaymentTimeLimit
    ? String(termsNode.PaymentTimeLimit)
    : null;

  let baggageKg;
  if (baggage.checked?.included && typeof baggage.checked.weightKg === "number") {
    if (baggage.checked.weightKg > 0) baggageKg = baggage.checked.weightKg;
  }

  return {
    brandRef: brandRef || null,
    brandName: brand?.name ? String(brand.name) : null,
    brandCode: brand?.code ? String(brand.code) : null,
    fareBasisCode: productCodes.fareBasisCode || null,
    bookingClass: productCodes.bookingClass || null,
    fareType: productCodes.fareType || null,
    validatingCarrier: validatingCarrier ? String(validatingCarrier).toUpperCase() : null,
    paymentTimeLimit,
    ...(refundable != null ? { refundable } : {}),
    ...(baggageKg != null ? { baggageKg } : {}),
    ...(Object.keys(baggage).length ? { baggage } : {}),
    fareRulesSummary: {
      ...(changes ? { changes } : {}),
      ...(cancellation ? { cancellation } : {}),
      ...(refund ? { refund } : {}),
    },
    ...(priceBreakdown ? { priceBreakdown } : {}),
    ...(productCodes.seatsAvailable != null
      ? { seatsAvailable: productCodes.seatsAvailable }
      : {}),
  };
}
