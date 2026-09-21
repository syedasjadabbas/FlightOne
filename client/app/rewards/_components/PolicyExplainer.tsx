import { TravellerSection } from "@/app/components/traveller";
import type { RewardsPolicy } from "@/lib/api/rewards.api";
import { labelize } from "./rewardsFormat";

export function PolicyExplainer({ policy }: { policy: RewardsPolicy | undefined }) {
  if (!policy) return null;

  return (
    <>
      <TravellerSection title="How points are earned">
        <ul className="fo-traveller__list">
          {(policy.earningEvents || []).map((event) => (
            <li key={event.id} className="fo-traveller__row">
              <p className="fo-traveller__row-title">{labelize(event.id)}</p>
              <p className="fo-traveller__row-body">{event.description}</p>
              <p className="fo-traveller__row-meta">
                Status: {event.status}
                {event.rate
                  ? ` · ${event.rate.pointsPerHundredMinor} pt per 100 minor units`
                  : ""}
                {typeof event.points === "number" ? ` · ${event.points} pts` : ""}
                {event.eligibleBookingStatuses?.length
                  ? ` · eligible: ${event.eligibleBookingStatuses.join(", ")}`
                  : ""}
              </p>
            </li>
          ))}
        </ul>
      </TravellerSection>

      <TravellerSection
        title="Redemption"
        note="Points are not cashed out. Checkout is the live redemption path."
      >
        <ul className="fo-traveller__list">
          {(policy.redemptionOptions || []).map((opt) => (
            <li key={opt.id} className="fo-traveller__row">
              <p className="fo-traveller__row-title">{labelize(opt.id)}</p>
              <p className="fo-traveller__row-body">{opt.description}</p>
              <p className="fo-traveller__row-meta">
                Status: {opt.status}
                {opt.appliesToBookingStatus ? ` · booking must be ${opt.appliesToBookingStatus}` : ""}
              </p>
            </li>
          ))}
        </ul>
        <p className="fo-traveller__section-note mt-2">
          Apply credits from a quoted booking at checkout. This page does not change your balance.
        </p>
      </TravellerSection>

      <TravellerSection title="Membership tiers" note={policy.tierNotes}>
        <ul className="fo-traveller__list">
          {(policy.tierThresholds || []).map((row) => (
            <li key={row.tier} className="fo-traveller__row">
              <p className="fo-traveller__row-title">{row.tier}</p>
              <p className="fo-traveller__row-meta">
                From {row.minInclusive} lifetime pts earned
                {row.nextAt ? ` · next ${row.nextTier} at ${row.nextAt}` : " · highest configured tier"}
              </p>
            </li>
          ))}
        </ul>
      </TravellerSection>
    </>
  );
}
