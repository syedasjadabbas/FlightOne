"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
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
      title="Travel preferences"
      note="Used to rank flights and prefill seat, meal, and airline choices."
      panel
    >
      <form onSubmit={onSave} className="space-y-0" aria-busy={isLoading || undefined}>
        <div className="fo-profile__form-block">
          <p className="fo-profile__form-label">Identity</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input
              label="Display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Asjad Abbas"
              required
            />
            <Input
              label="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+92 300 1234567"
              hint="For ticketing and SMS alerts"
            />
            <Input
              label="Nationality"
              value={nationality}
              onChange={(e) => setNationality(e.target.value)}
              placeholder="PK"
              maxLength={2}
              hint="ISO 2-letter code"
            />
          </div>
        </div>

        <div className="fo-profile__form-block">
          <p className="fo-profile__form-label">Flight preferences</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-[13px] font-medium text-ink-soft">
                Preferred cabin
              </label>
              <SearchableSelect
                options={CABIN_OPTIONS}
                value={cabin}
                onChange={setCabin}
                searchable={false}
                clearable
                placeholder="Any cabin"
              />
            </div>
            <Input
              label="Seat"
              value={seatPref}
              onChange={(e) => setSeatPref(e.target.value)}
              placeholder="Aisle, window…"
            />
            <Input
              label="Meal"
              value={mealPref}
              onChange={(e) => setMealPref(e.target.value)}
              placeholder="Halal, vegetarian…"
            />
            <Input
              label="Max layover (hours)"
              type="number"
              min={0}
              step={1}
              value={maxLayoverHours}
              onChange={(e) => setMaxLayoverHours(e.target.value)}
              placeholder="4"
            />
          </div>
        </div>

        <div className="fo-profile__form-block">
          <p className="fo-profile__form-label">Preferred airlines</p>
          <Input
            label="IATA codes"
            value={airlines}
            onChange={(e) => setAirlines(e.target.value)}
            placeholder="EK, QR, PK"
            hint="Comma-separated · soft preference in search ranking"
          />
          <div>
            <p className="fo-traveller__field-hint mb-2">Quick add</p>
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
                    {selected ? <Check size={12} strokeWidth={2.25} aria-hidden /> : null}
                    {a.name} ({a.code})
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="fo-profile__form-block flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {error ? (
              <p className="text-[13px] font-medium text-[var(--danger)]" role="alert">
                Could not save. Check fields and try again.
              </p>
            ) : null}
            {isSuccess ? (
              <p className="text-[13px] font-medium text-[var(--sky)]" role="status">
                Preferences saved.
              </p>
            ) : null}
          </div>
          <Button type="submit" disabled={isLoading} size="sm">
            {isLoading ? (
              <>
                <Spinner size="sm" className="border-white/30 border-t-white" label={null} />
                Saving…
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
