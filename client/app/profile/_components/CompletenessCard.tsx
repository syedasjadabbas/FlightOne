"use client";

import type { TravellerProfile } from "@/lib/api/profile.api";
import { TravellerSection } from "@/app/components/traveller";

const REQUIRED_KEYS = new Set([
  "displayName",
  "phone",
  "seatPref",
  "mealPref",
  "preferredAirlines",
  "passport",
  "emergencyContact",
]);

const REQUIRED_LABELS: Record<string, string> = {
  displayName: "Display name",
  phone: "Phone",
  seatPref: "Seat preference",
  mealPref: "Meal preference",
  preferredAirlines: "Preferred airlines",
  passport: "Passport on file",
  emergencyContact: "Emergency contact",
};

export function CompletenessCard({ profile }: { profile: TravellerProfile }) {
  const c = profile.completeness;
  if (!c) return null;
  const missingRequired = c.missing.filter((k) => REQUIRED_KEYS.has(k));
  const optionalHints = [
    !profile.nationality ? "Nationality (optional)" : null,
    !profile.preferredCabin ? "Preferred cabin (optional)" : null,
    profile.maxLayoverMinutes == null ? "Max layover (optional)" : null,
  ].filter(Boolean);

  return (
    <TravellerSection title="Profile completeness">
      <p className="fo-traveller__score">
        {c.score}
        <span className="ml-1.5 text-[0.875rem] font-medium tracking-normal text-ink-faint">
          % ready
        </span>
      </p>
      <p className="fo-traveller__section-note">
        {c.readyForHandsFreeBooking
          ? "Enough for hands-free booking prep."
          : "Finish required items below."}
      </p>
      <div
        className="fo-traveller__progress"
        role="progressbar"
        aria-valuenow={c.score}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span style={{ width: `${Math.max(0, Math.min(100, c.score))}%` }} />
      </div>
      {missingRequired.length > 0 ? (
        <div>
          <p className="text-[12px] font-medium text-ink-soft">Required</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[13px] text-ink-soft">
            {missingRequired.map((k) => (
              <li key={k}>{REQUIRED_LABELS[k] ?? k}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {optionalHints.length > 0 ? (
        <div>
          <p className="text-[12px] font-medium text-ink-faint">Optional</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[13px] text-ink-faint">
            {optionalHints.map((h) => (
              <li key={String(h)}>{h}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </TravellerSection>
  );
}
