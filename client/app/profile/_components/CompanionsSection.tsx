"use client";

import { useState } from "react";
import { Button, Input, SearchableSelect, Spinner } from "@/components/ui";
import { TravellerSection, TravellerState } from "@/app/components/traveller";
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
    <TravellerSection title="Family & companions" panel>
      {dupes?.hasDuplicates ? (
        <div className="fo-traveller__panel" style={{ padding: "0.75rem 0.85rem" }}>
          <p className="text-[13px] text-ink-soft">
            Possible duplicates detected on this account.
          </p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={deduping}
            onClick={() => applyDedupe()}
          >
            {deduping ? "Merging…" : "Merge safe duplicates"}
          </Button>
          <p className="fo-traveller__field-hint">
            Conflicting passport numbers are never deleted automatically.
          </p>
        </div>
      ) : null}
      {isLoading ? (
        <Spinner label="Loading companions" />
      ) : data.length === 0 ? (
        <TravellerState title="No saved travellers">
          Add family or companions for multi-pax bookings.
        </TravellerState>
      ) : (
        <ul className="fo-traveller__list">
          {data.map((c) => (
            <li key={c.id} className="fo-traveller__row">
              <div className="fo-traveller__row-top">
                <div>
                  <p className="fo-traveller__row-title">{c.fullName}</p>
                  <p className="fo-traveller__row-meta">
                    {c.kind === "FAMILY" ? "Family" : "Companion"}
                    {c.relationship ? ` · ${c.relationship}` : ""}
                    {c.dateOfBirth
                      ? ` · DOB ${new Date(c.dateOfBirth).toLocaleDateString()}`
                      : ""}
                    {c.hasPassport ? " · passport on file (encrypted)" : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(c.id)}
                >
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={onAdd} className="space-y-3 border-t border-line pt-4">
        <Input
          label="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />
        <SearchableSelect
          id="kind"
          label="Type"
          options={KIND_OPTIONS}
          value={kind}
          onChange={(v) => setKind(v as "COMPANION" | "FAMILY")}
          searchable={false}
        />
        <Input
          label="Relationship"
          value={relationship}
          onChange={(e) => setRelationship(e.target.value)}
          placeholder="spouse, child…"
          hint="Optional"
        />
        <Input
          label="Date of birth"
          type="date"
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
          hint="Optional — helps dedupe"
        />
        <Input
          label="Passport number"
          value={passportNumber}
          onChange={(e) => setPassportNumber(e.target.value)}
          autoComplete="off"
          hint="Encrypted at rest — never shown in the list"
        />
        <Input
          label="Passport expiry"
          type="date"
          value={passportExpiry}
          onChange={(e) => setPassportExpiry(e.target.value)}
          hint="Optional"
        />
        {formError ? (
          <p className="text-[13px] text-[var(--danger)]" role="alert">
            {formError}
          </p>
        ) : null}
        <Button type="submit" disabled={saving} size="sm">
          Add traveller
        </Button>
      </form>
    </TravellerSection>
  );
}
