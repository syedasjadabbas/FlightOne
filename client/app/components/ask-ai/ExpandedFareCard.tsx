"use client";

import {
  Luggage,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import type { BaggageAllowance, FareRulesSummary } from "@/lib/inventory/fareTypes";
import { fareRuleRows } from "@/lib/inventory/fareDisplay";

export type ExpandedFareCardProps = {
  // Brand & Cabin
  fareBrand?: string | null;
  cabin?: string | null;
  bookingClass?: string | null;

  // Itinerary Context
  isMultiLeg?: boolean;
  isMultiTicket?: boolean;
  isRoundTrip?: boolean;
  legCount?: number;
  faresOnItinerary?: number | null;

  // Baggage (structured or string items)
  baggageAllowance?: BaggageAllowance;
  baggageKg?: number;
  baggageSummary?: string;
  customBaggageItems?: string[];

  // Fare Rules & Policies
  fareRulesSummary?: FareRulesSummary;
  refundable?: boolean;
  customRules?: Array<{ label: string; value: string }>;

  // Pricing
  price: string;
  priceCode?: string;
  priceAmount?: string;

  // Action
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
};

function getPolicyTone(
  label: string,
  value: string,
): "emerald" | "amber" | "rose" | "sky" {
  const text = `${label} ${value}`.toLowerCase();
  if (
    text.includes("not permitted") ||
    text.includes("non-refundable") ||
    text.includes("no refund") ||
    text.includes("forfeits") ||
    text.includes("no changes")
  ) {
    return "rose";
  }
  if (
    text.includes("penalty") ||
    text.includes("fee applies") ||
    text.includes("with fee") ||
    text.includes("charge")
  ) {
    return "amber";
  }
  if (
    text.includes("free") ||
    text.includes("included") ||
    text.includes("refundable") ||
    (text.includes("permitted") && !text.includes("penalty"))
  ) {
    return "emerald";
  }
  return "sky";
}

function resolveBaggageItems(
  allowance?: BaggageAllowance,
  baggageKg?: number,
  baggageSummary?: string,
  customItems?: string[],
): string[] {
  if (customItems && customItems.length > 0) return customItems;

  const items: string[] = [];

  if (allowance?.carryOn) {
    const c = allowance.carryOn;
    if (c.included) {
      items.push(c.pieces ? `Carry-on: ${c.pieces} piece included` : "Carry-on included");
    } else if (c.text) {
      items.push(`Carry-on: ${c.text}`);
    } else {
      items.push("Carry-on not included");
    }
  }

  if (allowance?.checked) {
    const b = allowance.checked;
    if (b.included) {
      if (b.weightKg != null && b.weightKg > 0) {
        items.push(`Checked bag: ${b.weightKg}kg included`);
      } else if (b.pieces) {
        items.push(`Checked bag: ${b.pieces} piece included`);
      } else {
        items.push("Checked bag included");
      }
    } else if (b.weightKg === 0 || b.included === false) {
      items.push("Checked bag not included");
    } else if (b.text) {
      items.push(`Checked bag: ${b.text}`);
    }
  } else if (baggageKg != null && baggageKg > 0) {
    items.push(`Checked bag: ${baggageKg}kg included`);
  }

  if (items.length === 0 && baggageSummary) {
    const parts = baggageSummary.split(" · ").map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) {
      return parts;
    }
  }

  if (items.length === 0) {
    items.push("Standard cabin baggage included (Subject to airline policy)");
  }

  return items;
}

export function ExpandedFareCard({
  fareBrand,
  cabin,
  bookingClass,
  isMultiLeg,
  isMultiTicket,
  isRoundTrip,
  legCount = 1,
  faresOnItinerary,
  baggageAllowance,
  baggageKg,
  baggageSummary,
  customBaggageItems,
  fareRulesSummary,
  refundable,
  customRules,
  price,
  priceCode: rawPriceCode,
  priceAmount: rawPriceAmount,
  actionLabel = "Proceed to checkout",
  onAction,
  actionDisabled,
}: ExpandedFareCardProps) {
  // Parse price parts
  let priceCode = rawPriceCode;
  let priceAmount = rawPriceAmount;
  if (!priceCode || !priceAmount) {
    const parts = price.trim().split(/\s+/);
    priceCode = priceCode ?? (parts.length > 1 ? parts[0] : "");
    priceAmount = priceAmount ?? (parts.length > 1 ? parts.slice(1).join(" ") : price);
  }

  // Derive Brand / Cabin display
  const title =
    fareBrand?.trim() ||
    (cabin === "business"
      ? "Business Class"
      : cabin === "premium"
        ? "Premium Economy"
        : cabin === "economy"
          ? "Economy Standard"
          : isMultiLeg
            ? "Complete Trip Fare"
            : "Standard Fare");

  const baggageItems = resolveBaggageItems(
    baggageAllowance,
    baggageKg,
    baggageSummary,
    customBaggageItems,
  );

  const ruleRows =
    customRules && customRules.length > 0
      ? customRules
      : fareRuleRows(fareRulesSummary, refundable ?? undefined);

  const finalRules =
    ruleRows.length > 0
      ? ruleRows
      : [
          {
            label: "Fare conditions",
            value: "Standard airline ticket terms & conditions apply",
          },
        ];

  return (
    <div className="fo-expanded-fare">
      {/* Top Identity & Verification Header */}
      <div className="fo-expanded-fare__header">
        <div className="fo-expanded-fare__identity">
          <div className="fo-expanded-fare__icon-wrap">
            <Sparkles className="fo-expanded-fare__sparkle-icon" aria-hidden />
          </div>
          <div>
            <div className="fo-expanded-fare__title-row">
              <span className="fo-expanded-fare__title">{title}</span>
              {bookingClass ? (
                <span className="fo-expanded-fare__badge fo-expanded-fare__badge--class">
                  Class {bookingClass}
                </span>
              ) : null}
            </div>
            <div className="fo-expanded-fare__tags">
              {isRoundTrip ? (
                <span className="fo-expanded-fare__badge">Round trip</span>
              ) : null}
              {isMultiTicket ? (
                <span className="fo-expanded-fare__badge fo-expanded-fare__badge--warn">
                  Multi-ticket (Self-transfer)
                </span>
              ) : isMultiLeg && legCount > 1 ? (
                <span className="fo-expanded-fare__badge fo-expanded-fare__badge--sky">
                  Through-ticket · {legCount} flights
                </span>
              ) : null}
              {faresOnItinerary && faresOnItinerary > 1 ? (
                <span className="fo-expanded-fare__badge fo-expanded-fare__badge--sky">
                  {faresOnItinerary} fares on itinerary
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="fo-expanded-fare__guarantee">
          <ShieldCheck className="fo-expanded-fare__shield-icon" aria-hidden />
          <span>Guaranteed Fare</span>
        </div>
      </div>

      {/* Inclusions & Policies Grid */}
      <div className="fo-expanded-fare__grid">
        {/* Baggage Inclusions Block */}
        <div className="fo-expanded-fare__section">
          <div className="fo-expanded-fare__section-head">
            <Luggage className="fo-expanded-fare__section-icon" aria-hidden />
            <span>Baggage Allowance</span>
          </div>
          <div className="fo-expanded-fare__items">
            {baggageItems.map((item, idx) => (
              <div key={idx} className="fo-expanded-fare__item">
                <span className="fo-expanded-fare__item-bullet fo-expanded-fare__item-bullet--emerald" />
                <span className="fo-expanded-fare__item-text">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Flexibility & Policy Block */}
        <div className="fo-expanded-fare__section">
          <div className="fo-expanded-fare__section-head">
            <RotateCcw className="fo-expanded-fare__section-icon" aria-hidden />
            <span>Flexibility &amp; Policies</span>
          </div>
          <div className="fo-expanded-fare__items">
            {finalRules.map((rule, idx) => {
              const tone = getPolicyTone(rule.label, rule.value);
              return (
                <div key={idx} className="fo-expanded-fare__item">
                  <span
                    className={`fo-expanded-fare__item-bullet fo-expanded-fare__item-bullet--${tone}`}
                  />
                  <span className="fo-expanded-fare__item-text">
                    <strong className="fo-expanded-fare__rule-label">
                      {rule.label}:
                    </strong>{" "}
                    {rule.value}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pricing & Checkout Action Strip */}
      <div className="fo-expanded-fare__footer">
        <div className="fo-expanded-fare__price-group">
          <span className="fo-expanded-fare__price-eyebrow">
            {legCount > 1 ? "Complete Trip Fare" : "Total Airfare"}
          </span>
          <div className="fo-expanded-fare__price-row">
            {priceCode ? (
              <span className="fo-expanded-fare__price-code">{priceCode}</span>
            ) : null}
            <span className="fo-expanded-fare__price-amount">{priceAmount}</span>
          </div>
          <span className="fo-expanded-fare__price-note">
            All taxes, airport fees &amp; surcharges included
          </span>
        </div>

        {onAction ? (
          <button
            type="button"
            onClick={onAction}
            disabled={actionDisabled}
            className="fo-expanded-fare__cta-btn group"
          >
            <span>{actionLabel}</span>
            <ArrowRight className="fo-expanded-fare__cta-arrow group-hover:translate-x-1" aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
}
