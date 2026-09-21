"use client";

import { useState } from "react";
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
    <TravellerSection title="Emergency contacts" panel>
      {isLoading ? (
        <Spinner label="Loading contacts" />
      ) : data.length === 0 ? (
        <TravellerState title="No emergency contact">
          Required for booking readiness — add at least one.
        </TravellerState>
      ) : (
        <ul className="fo-traveller__list">
          {data.map((c) => (
            <li key={c.id} className="fo-traveller__row">
              <div className="fo-traveller__row-top">
                <div>
                  <p className="fo-traveller__row-title inline-flex flex-wrap items-center gap-2">
                    {c.fullName}
                    {c.isPrimary ? <TravellerChip>Primary</TravellerChip> : null}
                  </p>
                  <p className="fo-traveller__row-meta">
                    {c.phone}
                    {c.relationship ? ` · ${c.relationship}` : ""}
                  </p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => remove(c.id)}>
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={onAdd} className="space-y-3 border-t border-line pt-4">
        <Input label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        <Input
          label="Relationship"
          value={relationship}
          onChange={(e) => setRelationship(e.target.value)}
          hint="Optional"
        />
        <Button type="submit" disabled={saving} size="sm">
          Add contact
        </Button>
      </form>
    </TravellerSection>
  );
}
