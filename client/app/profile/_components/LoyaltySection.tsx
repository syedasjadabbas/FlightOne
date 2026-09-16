"use client";

import { useState } from "react";
import { Button, Input, SearchableSelect, Spinner } from "@/components/ui";
import { TravellerSection, TravellerState } from "@/app/components/traveller";
import {
  useCreateLoyaltyMutation,
  useDeleteLoyaltyMutation,
  useListLoyaltyQuery,
} from "@/lib/api/profile.api";

const LOYALTY_TYPE_OPTIONS = [
  { value: "AIRLINE", label: "Frequent flyer" },
  { value: "HOTEL", label: "Hotel loyalty" },
];

export function LoyaltySection() {
  const { data = [], isLoading } = useListLoyaltyQuery();
  const [createLoyalty, { isLoading: saving }] = useCreateLoyaltyMutation();
  const [remove] = useDeleteLoyaltyMutation();
  const [type, setType] = useState<"AIRLINE" | "HOTEL">("AIRLINE");
  const [programCode, setProgramCode] = useState("");
  const [memberNumber, setMemberNumber] = useState("");

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!programCode.trim() || !memberNumber.trim()) return;
    await createLoyalty({
      type,
      programCode: programCode.trim().toUpperCase(),
      memberNumber: memberNumber.trim(),
    });
    setProgramCode("");
    setMemberNumber("");
  }

  return (
    <TravellerSection
      title="Loyalty memberships"
      note="Frequent flyer numbers and hotel loyalty programs."
      panel
    >
      {isLoading ? (
        <Spinner label="Loading loyalty" />
      ) : data.length === 0 ? (
        <TravellerState title="No memberships saved">
          Add a frequent flyer or hotel program for booking prep.
        </TravellerState>
      ) : (
        <ul className="fo-traveller__list">
          {data.map((m) => (
            <li key={m.id} className="fo-traveller__row">
              <div className="fo-traveller__row-top">
                <div>
                  <p className="fo-traveller__row-title">
                    {m.programCode}{" "}
                    <span className="font-normal text-ink-faint">
                      · {m.type === "AIRLINE" ? "Airline FF" : "Hotel"}
                    </span>
                  </p>
                  <p className="fo-traveller__row-meta">••••{m.memberNumber.slice(-4)}</p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => remove(m.id)}>
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={onAdd} className="space-y-3 border-t border-line pt-4">
        <SearchableSelect
          id="loy-type"
          label="Type"
          options={LOYALTY_TYPE_OPTIONS}
          value={type}
          onChange={(v) => setType(v as "AIRLINE" | "HOTEL")}
          searchable={false}
        />
        <Input
          label="Program code"
          value={programCode}
          onChange={(e) => setProgramCode(e.target.value)}
          placeholder="EY / MARRIOTT"
          required
        />
        <Input
          label="Member number"
          value={memberNumber}
          onChange={(e) => setMemberNumber(e.target.value)}
          required
        />
        <Button type="submit" disabled={saving} size="sm">
          Add membership
        </Button>
      </form>
    </TravellerSection>
  );
}
