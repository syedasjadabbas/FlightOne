"use client";

import {
  AlertCircle,
  Check,
  ChevronRight,
  FileText,
  HeartHandshake,
  Phone,
  Plane,
  ShieldCheck,
  Sofa,
  Sparkles,
  UtensilsCrossed,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { TravellerProfile } from "@/lib/api/profile.api";
import type { ProfileTab } from "./ProfileTabs";

const REQUIRED_KEYS = new Set([
  "displayName",
  "phone",
  "seatPref",
  "mealPref",
  "preferredAirlines",
  "passport",
  "emergencyContact",
]);

type GapItem = {
  key: string;
  label: string;
  hint: string;
  tab: ProfileTab;
  fieldId?: string;
  icon: LucideIcon;
  required: boolean;
};

const REQUIRED_ITEMS: Record<string, Omit<GapItem, "key" | "required">> = {
  displayName: {
    label: "Display Name",
    hint: "Verified passenger name on tickets",
    tab: "PREFERENCES",
    fieldId: "profile-field-displayName",
    icon: UserRound,
  },
  phone: {
    label: "Phone Number",
    hint: "Urgent SMS & flight disruption alerts",
    tab: "PREFERENCES",
    fieldId: "profile-field-phone",
    icon: Phone,
  },
  seatPref: {
    label: "Seat Preference",
    hint: "Aisle, window, or forward bulkhead",
    tab: "PREFERENCES",
    fieldId: "profile-field-seatPref",
    icon: Sofa,
  },
  mealPref: {
    label: "Meal Preference",
    hint: "Special dietary & culinary options",
    tab: "PREFERENCES",
    fieldId: "profile-field-mealPref",
    icon: UtensilsCrossed,
  },
  preferredAirlines: {
    label: "Preferred Carriers",
    hint: "Alliance & airline preference ranking",
    tab: "PREFERENCES",
    fieldId: "profile-field-airlines",
    icon: Plane,
  },
  passport: {
    label: "Passport on File",
    hint: "Encrypted document for instant issuance",
    tab: "DOCUMENTS",
    icon: FileText,
  },
  emergencyContact: {
    label: "Emergency Contact",
    hint: "Primary contact for travel safety",
    tab: "EMERGENCY",
    icon: HeartHandshake,
  },
};

export function CompletenessCard({
  profile,
  onNavigate,
}: {
  profile: TravellerProfile;
  onNavigate?: (tab: ProfileTab, fieldId?: string) => void;
}) {
  const c = profile.completeness;
  if (!c) return null;

  const missingRequired: GapItem[] = c.missing
    .filter((k) => REQUIRED_KEYS.has(k) && REQUIRED_ITEMS[k])
    .map((k) => ({ key: k, required: true, ...REQUIRED_ITEMS[k] }));

  const rawOptionalGaps: (GapItem | null)[] = [
    !profile.nationality
      ? {
          key: "nationality",
          label: "Nationality",
          hint: "ISO 2-letter country code",
          tab: "PREFERENCES",
          fieldId: "profile-field-nationality",
          icon: UserRound,
          required: false,
        }
      : null,
    !profile.preferredCabin
      ? {
          key: "preferredCabin",
          label: "Preferred Cabin",
          hint: "Default search cabin tier",
          tab: "PREFERENCES",
          fieldId: "profile-field-cabin",
          icon: Sofa,
          required: false,
        }
      : null,
    profile.maxLayoverMinutes == null
      ? {
          key: "maxLayover",
          label: "Max Layover Time",
          hint: "Maximum acceptable transit duration",
          tab: "PREFERENCES",
          fieldId: "profile-field-maxLayover",
          icon: Plane,
          required: false,
        }
      : null,
  ];

  const optionalGaps: GapItem[] = rawOptionalGaps.filter(
    (item): item is GapItem => item !== null
  );

  const ready = c.readyForHandsFreeBooking || missingRequired.length === 0;
  const score = Math.max(0, Math.min(100, c.score));

  function handleItem(item: GapItem) {
    onNavigate?.(item.tab, item.fieldId);
  }

  return (
    <div className="fo-profile__deck-card" aria-label="Booking readiness waypoints">
      {/* Header bar */}
      <div className="fo-profile__deck-head">
        <div className="fo-profile__deck-copy">
          <div className="fo-profile__deck-eyebrow">
            <span className="fo-profile__deck-dot" aria-hidden />
            <span>WAYPOINT CHECKLIST · BOOKING READINESS</span>
          </div>
          <h3 className="fo-profile__deck-title">
            {ready ? "Flight Dossier Fully Verified" : "Required Action Items"}
          </h3>
          <p className="fo-profile__deck-desc">
            {ready
              ? "All essential identity and preference waypoints are verified for autonomous instant booking."
              : `Complete ${missingRequired.length} required field${missingRequired.length === 1 ? "" : "s"} so our automated systems can issue tickets without manual review.`}
          </p>
        </div>

        {/* Score dial badge */}
        <div className="fo-profile__deck-score-badge">
          <div className="fo-profile__deck-score-val">
            <span>{score}</span>
            <small>%</small>
          </div>
          <span className="fo-profile__deck-score-label">
            {ready ? "Flight Ready" : `${missingRequired.length} Pending`}
          </span>
        </div>
      </div>

      {/* Progress track */}
      <div
        className="fo-profile__deck-track"
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="fo-profile__deck-fill"
          style={{ width: `${score}%` }}
        />
      </div>

      {ready ? (
        <div className="fo-profile__deck-success">
          <div className="fo-profile__deck-success-icon" aria-hidden>
            <ShieldCheck size={20} strokeWidth={2.2} />
          </div>
          <div>
            <h4 className="fo-profile__deck-success-title">100% Booking Prep Complete</h4>
            <p className="fo-profile__deck-success-body">
              Your profile contains all details needed for direct hands-free ticket issuance and seat assignments.
            </p>
          </div>
        </div>
      ) : (
        <div className="fo-profile__deck-grid">
          {missingRequired.map((item) => (
            <WaypointCard
              key={item.key}
              item={item}
              onSelect={handleItem}
              statusType="required"
            />
          ))}
          {optionalGaps.map((item) => (
            <WaypointCard
              key={item.key}
              item={item}
              onSelect={handleItem}
              statusType="optional"
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WaypointCard({
  item,
  onSelect,
  statusType,
}: {
  item: GapItem;
  onSelect: (item: GapItem) => void;
  statusType: "required" | "optional";
}) {
  const Icon = item.icon;
  const isRequired = statusType === "required";

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className={`fo-profile__waypoint-card${isRequired ? " fo-profile__waypoint-card--req" : " fo-profile__waypoint-card--opt"}`}
    >
      <div className="fo-profile__waypoint-icon" aria-hidden>
        <Icon size={16} strokeWidth={2} />
      </div>

      <div className="fo-profile__waypoint-info">
        <div className="fo-profile__waypoint-top">
          <span className="fo-profile__waypoint-label">{item.label}</span>
          <span className={`fo-profile__waypoint-tag${isRequired ? " fo-profile__waypoint-tag--req" : ""}`}>
            {isRequired ? "Required" : "Optional"}
          </span>
        </div>
        <p className="fo-profile__waypoint-hint">{item.hint}</p>
      </div>

      <div className="fo-profile__waypoint-action" aria-hidden>
        <ChevronRight size={16} strokeWidth={2.2} />
      </div>
    </button>
  );
}
