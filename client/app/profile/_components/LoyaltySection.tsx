"use client";

import { useState } from "react";
import {
  Award,
  Building2,
  Plane,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button, Input, SearchableSelect, Spinner } from "@/components/ui";
import { TravellerSection, TravellerState } from "@/app/components/traveller";
import {
  useCreateLoyaltyMutation,
  useDeleteLoyaltyMutation,
  useListLoyaltyQuery,
} from "@/lib/api/profile.api";

const LOYALTY_TYPE_OPTIONS = [
  { value: "AIRLINE", label: "Frequent Flyer Program" },
  { value: "HOTEL", label: "Hotel Loyalty Program" },
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
      title="Loyalty Memberships"
      note="Frequent flyer numbers and hotel reward tiers for automated status upgrades and mileage earnings."
      panel
    >
      {isLoading ? (
        <div className="py-8 flex justify-center">
          <Spinner label="Loading loyalty programs…" />
        </div>
      ) : data.length === 0 ? (
        <div className="mb-6 rounded-2xl border border-dashed border-black/10 bg-white/50 p-6 text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-sky/10 text-sky">
            <Award size={18} strokeWidth={2} />
          </div>
          <p className="text-[14px] font-semibold text-navy">No Memberships Saved</p>
          <p className="text-[12.5px] text-ink-soft">Add airline frequent flyer or hotel loyalty programs for instant sync.</p>
        </div>
      ) : (
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {data.map((m) => {
            const isAirline = m.type === "AIRLINE";
            return (
              <div
                key={m.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-black/8 bg-white/90 p-4 shadow-sm transition-all hover:border-black/15"
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isAirline ? "bg-sky/10 text-sky" : "bg-amber-500/10 text-amber-600"}`}>
                    {isAirline ? (
                      <Plane size={18} strokeWidth={2} />
                    ) : (
                      <Building2 size={18} strokeWidth={2} />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold tracking-wider text-navy text-[14px]">
                        {m.programCode}
                      </span>
                      <span className="rounded-full bg-black/6 px-2 py-0.5 text-[10.5px] font-semibold text-ink-soft">
                        {isAirline ? "Airline FF" : "Hotel Reward"}
                      </span>
                    </div>
                    <p className="mt-0.5 font-mono text-[12px] text-ink-faint">
                      •••• •••• {m.memberNumber.slice(-4)}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(m.id)}
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

      {/* Add Loyalty Form */}
      <div className="rounded-2xl border border-black/8 bg-white/60 p-4.5 pt-4">
        <div className="mb-3.5 flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-sky/10 text-sky">
            <Award size={13} strokeWidth={2.2} />
          </span>
          <p className="text-[12px] font-bold tracking-wider text-ink-faint uppercase">
            Add Loyalty Program
          </p>
        </div>

        <form onSubmit={onAdd} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SearchableSelect
              id="loy-type"
              label="Program Category"
              options={LOYALTY_TYPE_OPTIONS}
              value={type}
              onChange={(v) => setType(v as "AIRLINE" | "HOTEL")}
              searchable={false}
            />
            <Input
              label="Program Code / Carrier"
              value={programCode}
              onChange={(e) => setProgramCode(e.target.value)}
              placeholder="e.g. EK, QR, HILTON"
              required
            />
            <Input
              label="Membership ID / Number"
              value={memberNumber}
              onChange={(e) => setMemberNumber(e.target.value)}
              placeholder="e.g. 192837465"
              required
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={saving} size="md">
              {saving ? (
                <>
                  <Spinner size="sm" className="border-white/30 border-t-white" label={null} />
                  Saving program…
                </>
              ) : (
                <>
                  <Plus size={14} strokeWidth={2.5} />
                  <span>Add Membership</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </TravellerSection>
  );
}
