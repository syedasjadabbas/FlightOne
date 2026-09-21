"use client";

import { useState } from "react";
import {
  Calendar,
  Lock,
  Plus,
  Trash2,
  User,
  UserPlus,
  Users,
} from "lucide-react";
import { Button, Input, SearchableSelect, Spinner } from "@/components/ui";
import { TravellerChip, TravellerSection, TravellerState } from "@/app/components/traveller";
import {
  useApplyProfileDedupeMutation,
  useCreateCompanionMutation,
  useDeleteCompanionMutation,
  useGetProfileDuplicatesQuery,
  useListCompanionsQuery,
} from "@/lib/api/profile.api";

const KIND_OPTIONS = [
  { value: "FAMILY", label: "Family member" },
  { value: "COMPANION", label: "Companion" },
];

export function CompanionsSection() {
  const { data = [], isLoading } = useListCompanionsQuery();
  const { data: dupes } = useGetProfileDuplicatesQuery();
  const [createCompanion, { isLoading: saving }] = useCreateCompanionMutation();
  const [applyDedupe, { isLoading: deduping }] = useApplyProfileDedupeMutation();
  const [remove] = useDeleteCompanionMutation();
  const [fullName, setFullName] = useState("");
  const [kind, setKind] = useState<"COMPANION" | "FAMILY">("FAMILY");
  const [relationship, setRelationship] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [passportNumber, setPassportNumber] = useState("");
  const [passportExpiry, setPassportExpiry] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!fullName.trim()) return;
    if (passportExpiry && !passportNumber.trim()) {
      setFormError("Passport expiry requires a passport number.");
      return;
    }
    if (passportNumber.trim() && passportNumber.trim().length < 3) {
      setFormError("Passport number looks too short.");
      return;
    }
    try {
      await createCompanion({
        fullName: fullName.trim(),
        kind,
        relationship: relationship.trim() || undefined,
        dateOfBirth: dateOfBirth || undefined,
        passportNumber: passportNumber.trim() || undefined,
        passportExpiry: passportExpiry || undefined,
      }).unwrap();
      setFullName("");
      setRelationship("");
      setDateOfBirth("");
      setPassportNumber("");
      setPassportExpiry("");
    } catch {
      setFormError("Could not save companion. Check fields and try again.");
    }
  }

  return (
    <TravellerSection
      title="Family & Companions"
      note="Manage companion profiles for group travel and multi-passenger bookings."
      panel
    >
      {dupes?.hasDuplicates ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
          <div>
            <p className="text-[13px] font-semibold text-amber-900">
              Possible duplicates detected
            </p>
            <p className="text-[12px] text-amber-700/90">
              Multiple identical companion profiles can be automatically merged.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={deduping}
            onClick={() => applyDedupe()}
          >
            {deduping ? "Merging…" : "Merge safe duplicates"}
          </Button>
        </div>
      ) : null}

      {isLoading ? (
        <div className="py-8 flex justify-center">
          <Spinner label="Loading companions…" />
        </div>
      ) : data.length === 0 ? (
        <div className="mb-6 rounded-2xl border border-dashed border-black/10 bg-white/50 p-6 text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-sky/10 text-sky">
            <Users size={18} strokeWidth={2} />
          </div>
          <p className="text-[14px] font-semibold text-navy">No Saved Travellers</p>
          <p className="text-[12.5px] text-ink-soft">Add family members or companions for fast multi-pax booking.</p>
        </div>
      ) : (
        <div className="mb-6 space-y-2.5">
          {data.map((c) => {
            const initials = c.fullName
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();
            return (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/8 bg-white/90 p-3.5 shadow-sm transition-all hover:border-black/15"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy text-xs font-bold text-white shadow-sm">
                    {initials}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-[14px] font-bold text-navy">{c.fullName}</p>
                      <span className="rounded-full bg-black/6 px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
                        {c.kind === "FAMILY" ? "Family" : "Companion"}
                      </span>
                      {c.relationship ? (
                        <span className="text-[12px] text-ink-faint">· {c.relationship}</span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-3 text-[11.5px] text-ink-faint">
                      {c.dateOfBirth ? (
                        <span className="flex items-center gap-1">
                          <Calendar size={11} strokeWidth={2} />
                          DOB {new Date(c.dateOfBirth).toLocaleDateString()}
                        </span>
                      ) : null}
                      {c.hasPassport ? (
                        <span className="flex items-center gap-1 text-emerald">
                          <Lock size={11} strokeWidth={2} />
                          Encrypted Passport on File
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(c.id)}
                  className="text-danger hover:bg-danger/10"
                >
                  <Trash2 size={13} strokeWidth={2} />
                  <span>Remove</span>
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Companion Form */}
      <div className="rounded-2xl border border-black/8 bg-white/60 p-4.5 pt-4">
        <div className="mb-3.5 flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-sky/10 text-sky">
            <UserPlus size={13} strokeWidth={2.2} />
          </span>
          <p className="text-[12px] font-bold tracking-wider text-ink-faint uppercase">
            Add New Companion
          </p>
        </div>

        <form onSubmit={onAdd} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input
              label="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Sarah Jenkins"
              required
            />
            <SearchableSelect
              id="kind"
              label="Passenger Type"
              options={KIND_OPTIONS}
              value={kind}
              onChange={(v) => setKind(v as "COMPANION" | "FAMILY")}
              searchable={false}
            />
            <Input
              label="Relationship"
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              placeholder="spouse, child, colleague…"
              hint="Optional"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input
              label="Date of birth"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              hint="Optional — helps dedupe passenger"
            />
            <Input
              label="Passport number"
              value={passportNumber}
              onChange={(e) => setPassportNumber(e.target.value)}
              autoComplete="off"
              placeholder="e.g. AB123456"
              hint="AES-256 encrypted at rest"
            />
            <Input
              label="Passport expiry"
              type="date"
              value={passportExpiry}
              onChange={(e) => setPassportExpiry(e.target.value)}
              hint="Optional"
            />
          </div>

          {formError ? (
            <p className="text-[13px] font-medium text-danger" role="alert">
              {formError}
            </p>
          ) : null}

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={saving} size="md">
              {saving ? (
                <>
                  <Spinner size="sm" className="border-white/30 border-t-white" label={null} />
                  Saving traveller…
                </>
              ) : (
                <>
                  <Plus size={14} strokeWidth={2.5} />
                  <span>Add Traveller</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </TravellerSection>
  );
}
