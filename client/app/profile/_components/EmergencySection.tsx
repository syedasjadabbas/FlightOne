"use client";

import { useState } from "react";
import {
  HeartHandshake,
  Phone,
  Plus,
  ShieldCheck,
  Trash2,
  User,
  UserPlus,
} from "lucide-react";
import { Button, Input, Spinner } from "@/components/ui";
import { TravellerChip, TravellerSection, TravellerState } from "@/app/components/traveller";
import {
  useCreateEmergencyContactMutation,
  useDeleteEmergencyContactMutation,
  useListEmergencyContactsQuery,
} from "@/lib/api/profile.api";

export function EmergencySection() {
  const { data = [], isLoading } = useListEmergencyContactsQuery();
  const [createContact, { isLoading: saving }] = useCreateEmergencyContactMutation();
  const [remove] = useDeleteEmergencyContactMutation();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [relationship, setRelationship] = useState("");

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim()) return;
    await createContact({
      fullName: fullName.trim(),
      phone: phone.trim(),
      relationship: relationship.trim() || undefined,
      isPrimary: data.length === 0,
    });
    setFullName("");
    setPhone("");
    setRelationship("");
  }

  return (
    <TravellerSection
      title="Emergency Contacts"
      note="Essential contacts required for flight safety dossiers and immediate travel disruption assistance."
      panel
    >
      {isLoading ? (
        <div className="py-8 flex justify-center">
          <Spinner label="Loading contacts…" />
        </div>
      ) : data.length === 0 ? (
        <div className="mb-6 rounded-2xl border border-dashed border-black/10 bg-white/50 p-6 text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
            <HeartHandshake size={18} strokeWidth={2} />
          </div>
          <p className="text-[14px] font-semibold text-navy">No Emergency Contact on File</p>
          <p className="text-[12.5px] text-ink-soft">Add at least one contact to achieve hands-free booking readiness.</p>
        </div>
      ) : (
        <div className="mb-6 space-y-2.5">
          {data.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/8 bg-white/90 p-3.5 shadow-sm transition-all hover:border-black/15"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald/10 text-emerald">
                  <HeartHandshake size={18} strokeWidth={2} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[14px] font-bold text-navy">{c.fullName}</p>
                    {c.isPrimary ? (
                      <span className="rounded-full bg-emerald/15 px-2 py-0.5 text-[11px] font-bold text-emerald">
                        Primary Contact
                      </span>
                    ) : null}
                    {c.relationship ? (
                      <span className="text-[12px] text-ink-faint">· {c.relationship}</span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink-soft">
                    <Phone size={11} strokeWidth={2} />
                    {c.phone}
                  </p>
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
          ))}
        </div>
      )}

      {/* Add Emergency Contact Form */}
      <div className="rounded-2xl border border-black/8 bg-white/60 p-4.5 pt-4">
        <div className="mb-3.5 flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-sky/10 text-sky">
            <UserPlus size={13} strokeWidth={2.2} />
          </span>
          <p className="text-[12px] font-bold tracking-wider text-ink-faint uppercase">
            Add Emergency Contact
          </p>
        </div>

        <form onSubmit={onAdd} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input
              label="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. David Vance"
              required
            />
            <Input
              label="Phone Number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 555 019 2834"
              required
            />
            <Input
              label="Relationship"
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              placeholder="Parent, spouse, friend…"
              hint="Optional"
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={saving} size="md">
              {saving ? (
                <>
                  <Spinner size="sm" className="border-white/30 border-t-white" label={null} />
                  Saving contact…
                </>
              ) : (
                <>
                  <Plus size={14} strokeWidth={2.5} />
                  <span>Add Contact</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </TravellerSection>
  );
}
