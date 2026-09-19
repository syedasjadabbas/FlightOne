"use client";

import { Input, SearchableSelect } from "@/components/ui";
import type { VaultVisaHolderStatus, VaultVisaMetaInput } from "@/lib/api/vault.api";
import {
  VISA_DESTINATION_OPTIONS,
  VISA_HOLDER_STATUS_OPTIONS,
  VISA_TYPE_OPTIONS,
} from "@/lib/vault/visaStatus";

export type VisaMetaFormValue = {
  destinationCode: string;
  visaType: string;
  holderStatus: VaultVisaHolderStatus;
  issuingAuthority: string;
  appointmentAt: string;
  appointmentLocation: string;
  remindersEnabled: boolean;
};

export function emptyVisaMetaForm(): VisaMetaFormValue {
  return {
    destinationCode: "",
    visaType: "tourist",
    holderStatus: "ISSUED",
    issuingAuthority: "",
    appointmentAt: "",
    appointmentLocation: "",
    remindersEnabled: true,
  };
}

export function visaMetaFormFromInput(
  meta: {
    destinationCode?: string | null;
    visaType?: string | null;
    holderStatus?: string | null;
    issuingAuthority?: string | null;
    appointmentAt?: string | null;
    appointmentLocation?: string | null;
    remindersEnabled?: boolean;
  } | null | undefined,
): VisaMetaFormValue {
  const base = emptyVisaMetaForm();
  if (!meta) return base;
  return {
    destinationCode: (meta.destinationCode || "").toUpperCase(),
    visaType: meta.visaType || "tourist",
    holderStatus: (meta.holderStatus as VaultVisaHolderStatus) || "ISSUED",
    issuingAuthority: meta.issuingAuthority || "",
    appointmentAt: meta.appointmentAt ? meta.appointmentAt.slice(0, 16) : "",
    appointmentLocation: meta.appointmentLocation || "",
    remindersEnabled: meta.remindersEnabled !== false,
  };
}

export function visaMetaFormToInput(form: VisaMetaFormValue): VaultVisaMetaInput {
  return {
    destinationCode: form.destinationCode.trim()
      ? form.destinationCode.trim().toUpperCase()
      : null,
    visaType: form.visaType.trim() || null,
    holderStatus: form.holderStatus,
    issuingAuthority: form.issuingAuthority.trim() || null,
    appointmentAt: form.appointmentAt ? new Date(form.appointmentAt).toISOString() : null,
    appointmentLocation: form.appointmentLocation.trim() || null,
    remindersEnabled: form.remindersEnabled,
  };
}

export function VisaMetaFields({
  value,
  onChange,
  disabled = false,
}: {
  value: VisaMetaFormValue;
  onChange: (next: VisaMetaFormValue) => void;
  disabled?: boolean;
}) {
  const destOptions = VISA_DESTINATION_OPTIONS.some((o) => o.value === value.destinationCode)
    ? VISA_DESTINATION_OPTIONS
    : value.destinationCode
      ? [
          { value: value.destinationCode, label: `${value.destinationCode} (entered)` },
          ...VISA_DESTINATION_OPTIONS,
        ]
      : VISA_DESTINATION_OPTIONS;

  const typeOptions = VISA_TYPE_OPTIONS.some((o) => o.value === value.visaType)
    ? [...VISA_TYPE_OPTIONS]
    : value.visaType
      ? [{ value: value.visaType, label: value.visaType }, ...VISA_TYPE_OPTIONS]
      : [...VISA_TYPE_OPTIONS];

  return (
    <div className="space-y-4 rounded-2xl border border-cyan-100 bg-cyan-50/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-cyan-800">
        Visa details
      </p>
      <SearchableSelect
        label="Destination country"
        options={destOptions}
        value={value.destinationCode}
        onChange={(destinationCode) => onChange({ ...value, destinationCode })}
        searchable
        clearable
        disabled={disabled}
        placeholder="Select destination…"
        hint="ISO country for this visa — used for expiry grouping and attributed guidance when available."
      />
      <Input
        label="Or enter ISO country code"
        value={value.destinationCode}
        onChange={(e) =>
          onChange({
            ...value,
            destinationCode: e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2),
          })
        }
        placeholder="AE"
        maxLength={2}
        disabled={disabled}
      />
      <SearchableSelect
        label="Visa type"
        options={typeOptions}
        value={value.visaType}
        onChange={(visaType) => onChange({ ...value, visaType })}
        searchable
        disabled={disabled}
      />
      <SearchableSelect
        label="Visa status"
        options={[...VISA_HOLDER_STATUS_OPTIONS]}
        value={value.holderStatus}
        onChange={(holderStatus) =>
          onChange({ ...value, holderStatus: holderStatus as VaultVisaHolderStatus })
        }
        disabled={disabled}
      />
      <Input
        label="Issuing authority (optional)"
        value={value.issuingAuthority}
        onChange={(e) => onChange({ ...value, issuingAuthority: e.target.value })}
        placeholder="e.g. UAE Embassy Islamabad — as printed on the visa"
        disabled={disabled}
        hint="Traveller-entered only. Embassy directory data is shown separately when attributed."
      />
      <Input
        label="Appointment date & time (optional)"
        type="datetime-local"
        value={value.appointmentAt}
        onChange={(e) => onChange({ ...value, appointmentAt: e.target.value })}
        disabled={disabled}
      />
      <Input
        label="Appointment location (optional)"
        value={value.appointmentLocation}
        onChange={(e) => onChange({ ...value, appointmentLocation: e.target.value })}
        placeholder="Embassy / VAC city"
        disabled={disabled}
      />
      <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
        <input
          type="checkbox"
          checked={value.remindersEnabled}
          onChange={(e) => onChange({ ...value, remindersEnabled: e.target.checked })}
          disabled={disabled}
        />
        Enable expiry reminders for this visa
      </label>
    </div>
  );
}
