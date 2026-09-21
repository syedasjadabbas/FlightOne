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
    <div className="fo-vault__visa-block">
      <p className="fo-vault__visa-label">Visa &amp; Entry Meta Specifications</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SearchableSelect
          label="Destination Country"
          options={destOptions}
          value={value.destinationCode}
          onChange={(destinationCode) => onChange({ ...value, destinationCode })}
          searchable
          clearable
          disabled={disabled}
          placeholder="Select destination…"
          hint="ISO country for visa rule calibration"
        />
        <Input
          label="ISO Country Code"
          value={value.destinationCode}
          onChange={(e) =>
            onChange({
              ...value,
              destinationCode: e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2),
            })
          }
          placeholder="e.g. US, AE, GB, SA"
          maxLength={2}
          disabled={disabled}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SearchableSelect
          label="Visa Classification"
          options={typeOptions}
          value={value.visaType}
          onChange={(visaType) => onChange({ ...value, visaType })}
          searchable
          disabled={disabled}
        />
        <SearchableSelect
          label="Visa Status"
          options={[...VISA_HOLDER_STATUS_OPTIONS]}
          value={value.holderStatus}
          onChange={(holderStatus) =>
            onChange({ ...value, holderStatus: holderStatus as VaultVisaHolderStatus })
          }
          disabled={disabled}
        />
      </div>

      <Input
        label="Issuing Authority (optional)"
        value={value.issuingAuthority}
        onChange={(e) => onChange({ ...value, issuingAuthority: e.target.value })}
        placeholder="e.g. US Embassy Islamabad / UAE Ministry"
        disabled={disabled}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label="Appointment Date & Time (optional)"
          type="datetime-local"
          value={value.appointmentAt}
          onChange={(e) => onChange({ ...value, appointmentAt: e.target.value })}
          disabled={disabled}
        />
        <Input
          label="Appointment Location (optional)"
          value={value.appointmentLocation}
          onChange={(e) => onChange({ ...value, appointmentLocation: e.target.value })}
          placeholder="e.g. VAC Diplomatic Enclave"
          disabled={disabled}
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-ink-soft pt-1">
        <input
          type="checkbox"
          checked={value.remindersEnabled}
          onChange={(e) => onChange({ ...value, remindersEnabled: e.target.checked })}
          disabled={disabled}
          className="h-4 w-4 rounded-md border-black/15 text-sky focus:ring-sky/20"
        />
        <span>Enable automated 90-day expiry notifications for this visa</span>
      </label>
    </div>
  );
}
