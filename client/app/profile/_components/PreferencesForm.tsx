"use client";

import { useEffect, useState } from "react";
import { Button, Input, SearchableSelect, Spinner } from "@/components/ui";
import {
  useUpdateProfileMutation,
  type ProfilePatch,
  type TravellerProfile,
} from "@/lib/api/profile.api";

const CABIN_OPTIONS = [
  { value: "", label: "No preference (Any cabin)" },
  { value: "ECONOMY", label: "Economy" },
  { value: "PREMIUM_ECONOMY", label: "Premium Economy" },
  { value: "BUSINESS", label: "Business Class" },
  { value: "FIRST", label: "First Class" },
];

const COMMON_AIRLINES = [
  { code: "EK", name: "Emirates" },
  { code: "QR", name: "Qatar Airways" },
  { code: "PK", name: "PIA" },
  { code: "TK", name: "Turkish Airlines" },
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
    <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs">
      <div className="border-b border-slate-100 pb-5">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight font-[var(--font-sora)]">
          Travel & Personal Preferences
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Ava consults these preferences to rank flights and personalize seat, meal, and airline recommendations automatically.
        </p>
      </div>

      <form onSubmit={onSave} className="mt-6 space-y-8" aria-busy={isLoading || undefined}>
        {/* Section 1: Personal Details */}
        <div className="space-y-4">
          <div className="text-xs font-bold uppercase tracking-wider text-cyan-800">
            1. Personal Identification
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Display Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Asjad Abbas"
              required
            />
            <Input
              label="Phone Number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+92 300 1234567"
              hint="Required for ticketing & SMS alerts"
            />
            <Input
              label="Nationality (ISO Code)"
              value={nationality}
              onChange={(e) => setNationality(e.target.value)}
              placeholder="PK"
              maxLength={2}
              hint="2-letter country code (e.g. PK, US, GB)"
            />
          </div>
        </div>

        {/* Section 2: In-Flight Preferences */}
        <div className="space-y-4 border-t border-slate-100 pt-6">
          <div className="text-xs font-bold uppercase tracking-wider text-cyan-800">
            2. Flight & Seating Preferences
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Preferred Cabin
              </label>
              <SearchableSelect
                options={CABIN_OPTIONS}
                value={cabin}
                onChange={setCabin}
                searchable={false}
                clearable
                placeholder="Any Cabin"
              />
            </div>

            <Input
              label="Seat Preference"
              value={seatPref}
              onChange={(e) => setSeatPref(e.target.value)}
              placeholder="e.g. Aisle, Window, Front"
              hint="Preferred seating zone"
            />

            <Input
              label="Meal Preference"
              value={mealPref}
              onChange={(e) => setMealPref(e.target.value)}
              placeholder="e.g. Halal, Vegetarian, Vegan"
              hint="Airline special meal code"
            />

            <Input
              label="Max Layover (Hours)"
              type="number"
              min={0}
              step={1}
              value={maxLayoverHours}
              onChange={(e) => setMaxLayoverHours(e.target.value)}
              placeholder="e.g. 4"
              hint="Max transit stopover"
            />
          </div>
        </div>

        {/* Section 3: Preferred Airlines */}
        <div className="space-y-4 border-t border-slate-100 pt-6">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-wider text-cyan-800">
              3. Preferred Airlines (IATA)
            </div>
            <span className="text-xs text-slate-400">Soft preference in Ava ranking</span>
          </div>

          <Input
            label="Airline IATA Codes (comma-separated)"
            value={airlines}
            onChange={(e) => setAirlines(e.target.value)}
            placeholder="EK, QR, PK, BA"
          />

          {/* Quick Select Airline Pills */}
          <div>
            <span className="block text-xs text-slate-500 mb-2">Tap to add/remove common carriers:</span>
            <div className="flex flex-wrap gap-2">
              {COMMON_AIRLINES.map((a) => {
                const selected = selectedAirlinesList.includes(a.code);
                return (
                  <button
                    key={a.code}
                    type="button"
                    onClick={() => toggleAirlinePill(a.code)}
                    className={`rounded-xl px-3 py-1 text-xs font-medium border transition-all ${
                      selected
                        ? "bg-cyan-600 text-white border-cyan-600 shadow-xs"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    {a.name} ({a.code}) {selected ? "✓" : "+"}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Action Status and Submit */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-100 pt-6">
          <div>
            {error && (
              <p className="text-xs font-semibold text-rose-600" role="alert">
                Could not save preferences. Please review inputs.
              </p>
            )}
            {isSuccess && (
              <p className="text-xs font-semibold text-emerald-700" role="status">
                ✓ Preferences updated and synced with Ava.
              </p>
            )}
          </div>

          <Button type="submit" disabled={isLoading} className="px-8 shadow-sm">
            {isLoading ? (
              <>
                <Spinner size="sm" className="border-white/30 border-t-white" label={null} />
                Saving Changes…
              </>
            ) : (
              "Save Preferences"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
