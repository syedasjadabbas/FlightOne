"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Plane,
  ShieldCheck,
  Sofa,
  Sparkles,
  UserRound,
  UtensilsCrossed,
} from "lucide-react";
import { Button, Input, SearchableSelect, Spinner } from "@/components/ui";
import { TravellerSection } from "@/app/components/traveller";
import {
  useUpdateProfileMutation,
  type ProfilePatch,
  type TravellerProfile,
} from "@/lib/api/profile.api";

const CABIN_OPTIONS = [
  { value: "", label: "No preference" },
  { value: "ECONOMY", label: "Economy" },
  { value: "PREMIUM_ECONOMY", label: "Premium Economy" },
  { value: "BUSINESS", label: "Business" },
  { value: "FIRST", label: "First" },
];

const COMMON_AIRLINES = [
  { code: "EK", name: "Emirates" },
  { code: "QR", name: "Qatar" },
  { code: "PK", name: "PIA" },
  { code: "TK", name: "Turkish" },
  { code: "BA", name: "British Airways" },
  { code: "EY", name: "Etihad" },
  { code: "SV", name: "Saudia" },
  { code: "FZ", name: "Flydubai" },
];

export function PreferencesForm({ profile }: { profile: TravellerProfile }) {
  const [updateProfile, { isLoading, isSuccess, error }] = useUpdateProfileMutation();
  const [displayName, setDisplayName] = useState(profile.displayName ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [nationality, setNationality] = useState(profile.nationality ?? "");
  const [seatPref, setSeatPref] = useState(profile.seatPref ?? "");
  const [mealPref, setMealPref] = useState(profile.mealPref ?? "");
  const [airlines, setAirlines] = useState(
    (profile.preferredAirlines ?? []).join(", "),
  );
  const [cabin, setCabin] = useState(profile.preferredCabin ?? "");
  const [maxLayoverHours, setMaxLayoverHours] = useState(
    profile.maxLayoverMinutes != null
      ? String(Math.round(profile.maxLayoverMinutes / 60))
      : "",
  );

  useEffect(() => {
    setDisplayName(profile.displayName ?? "");
    setPhone(profile.phone ?? "");
    setNationality(profile.nationality ?? "");
    setSeatPref(profile.seatPref ?? "");
    setMealPref(profile.mealPref ?? "");
    setAirlines((profile.preferredAirlines ?? []).join(", "));
    setCabin(profile.preferredCabin ?? "");
    setMaxLayoverHours(
      profile.maxLayoverMinutes != null
        ? String(Math.round(profile.maxLayoverMinutes / 60))
        : "",
    );
  }, [profile]);

  function toggleAirlinePill(code: string) {
    const list = airlines
      .split(/[,\s]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    if (list.includes(code)) {
      setAirlines(list.filter((c) => c !== code).join(", "));
    } else {
      setAirlines([...list, code].join(", "));
    }
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    const preferredAirlines = airlines
      .split(/[,\s]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 20);
    const hours = maxLayoverHours.trim() === "" ? null : Number(maxLayoverHours);
    const preferredCabin =
      cabin === "ECONOMY" ||
      cabin === "PREMIUM_ECONOMY" ||
      cabin === "BUSINESS" ||
      cabin === "FIRST"
        ? cabin
        : null;

    const patch: ProfilePatch = {
      displayName: displayName.trim() || profile.displayName,
      phone: phone.trim() || null,
      nationality: nationality.trim().length === 2 ? nationality.trim().toUpperCase() : null,
      seatPref: seatPref.trim() || null,
      mealPref: mealPref.trim() || null,
      preferredAirlines: preferredAirlines.length ? preferredAirlines : [],
      preferredCabin,
      maxLayoverMinutes:
        hours != null && Number.isFinite(hours) && hours >= 0
          ? Math.round(hours * 60)
          : null,
    };
    await updateProfile(patch);
  }

  const selectedAirlinesList = airlines
    .split(/[,\s]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  return (
    <TravellerSection
      title="Travel Preferences"
      note="Used to calibrate automated search rankings, prefill seats, and lock in meal selections."
      panel
    >
      <form onSubmit={onSave} className="space-y-6" aria-busy={isLoading || undefined}>
        {/* Block 1: Identity */}
        <div className="fo-profile__form-block">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-sky/10 text-sky">
              <UserRound size={13} strokeWidth={2.2} />
            </span>
            <p className="fo-profile__form-label">Passenger Identity</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input
              id="profile-field-displayName"
              label="Display Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Asjad Abbas"
              required
            />
            <Input
              id="profile-field-phone"
              label="Phone Number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+92 300 1234567"
              hint="For ticketing and SMS alerts"
            />
            <Input
              id="profile-field-nationality"
              label="Nationality"
              value={nationality}
              onChange={(e) => setNationality(e.target.value)}
              placeholder="PK"
              maxLength={2}
              hint="ISO 2-letter country code"
            />
          </div>
        </div>

        {/* Block 2: Flight & Seating */}
        <div className="fo-profile__form-block">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-sky/10 text-sky">
              <Sofa size={13} strokeWidth={2.2} />
            </span>
            <p className="fo-profile__form-label">Flight Preferences & Comfort</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div id="profile-field-cabin">
              <SearchableSelect
                label="Preferred Cabin"
                options={CABIN_OPTIONS}
                value={cabin}
                onChange={setCabin}
                searchable={false}
                clearable
                placeholder="Any cabin tier"
              />
            </div>
            <Input
              id="profile-field-seatPref"
              label="Seat Preference"
              value={seatPref}
              onChange={(e) => setSeatPref(e.target.value)}
              placeholder="Aisle, window, bulkhead…"
            />
            <Input
              id="profile-field-mealPref"
              label="Dietary / Meal"
              value={mealPref}
              onChange={(e) => setMealPref(e.target.value)}
              placeholder="Halal, vegetarian, vegan…"
            />
            <Input
              id="profile-field-maxLayover"
              label="Max Layover (Hours)"
              type="number"
              min={0}
              step={1}
              value={maxLayoverHours}
              onChange={(e) => setMaxLayoverHours(e.target.value)}
              placeholder="4"
            />
          </div>
        </div>

        {/* Block 3: Airlines */}
        <div className="fo-profile__form-block" id="profile-field-airlines">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-sky/10 text-sky">
              <Plane size={13} strokeWidth={2.2} />
            </span>
            <p className="fo-profile__form-label">Preferred Airlines & Alliances</p>
          </div>

          <Input
            id="profile-field-airlines-input"
            label="IATA Carrier Codes"
            value={airlines}
            onChange={(e) => setAirlines(e.target.value)}
            placeholder="EK, QR, PK, EY, BA"
            hint="Comma-separated IATA codes — soft preference in search rankings"
          />

          <div>
            <p className="text-[11.5px] font-semibold text-ink-faint uppercase tracking-wider mb-2">
              Quick Select Carriers
            </p>
            <div className="fo-profile__airline-pills">
              {COMMON_AIRLINES.map((a) => {
                const selected = selectedAirlinesList.includes(a.code);
                return (
                  <button
                    key={a.code}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleAirlinePill(a.code)}
                    className="fo-profile__airline-pill"
                  >
                    {selected ? <Check size={12} strokeWidth={2.5} className="text-sky" aria-hidden /> : null}
                    <span>{a.name} ({a.code})</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="fo-profile__form-block flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {error ? (
              <p className="text-[13px] font-medium text-danger" role="alert">
                Could not save preferences. Check fields and try again.
              </p>
            ) : null}
            {isSuccess ? (
              <p className="text-[13px] font-medium text-sky flex items-center gap-1.5" role="status">
                <Check size={14} strokeWidth={2.5} />
                <span>Preferences saved successfully.</span>
              </p>
            ) : null}
          </div>
          <Button type="submit" disabled={isLoading} size="md">
            {isLoading ? (
              <>
                <Spinner size="sm" className="border-white/30 border-t-white" label={null} />
                Saving preferences…
              </>
            ) : (
              "Save preferences"
            )}
          </Button>
        </div>
      </form>
    </TravellerSection>
  );
}
