import type { Companion, IdentityDocument, TravellerProfile } from "@/lib/api/profile.api";

export interface TravellerFormData {
  givenName: string;
  surname: string;
  nationality: string;
  dateOfBirth: string;
  passportNumber: string;
  passportExpiry: string;
  phone: string;
  email: string;
  companionId?: string | null;
  isAutoFilled?: boolean;
  sourceLabel?: string;
}

export function splitFullName(fullName: string | null | undefined): {
  givenName: string;
  surname: string;
} {
  const trimmed = String(fullName || "").trim();
  if (!trimmed) {
    return { givenName: "", surname: "" };
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { givenName: parts[0], surname: "" };
  }

  const surname = parts[parts.length - 1];
  const givenName = parts.slice(0, -1).join(" ");
  return { givenName, surname };
}

export function formatDateForInput(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

export function resolvePrimaryTraveller(
  profile?: TravellerProfile | null,
  documents?: IdentityDocument[] | null,
  user?: { name?: string | null; email?: string | null } | null,
): TravellerFormData {
  const nameToSplit = profile?.displayName || user?.name || "";
  const { givenName, surname } = splitFullName(nameToSplit);

  // Locate active primary passport from Traveller Vault
  const passportDoc = (documents || []).find(
    (doc) =>
      doc.type === "PASSPORT" &&
      doc.status === "ACTIVE" &&
      !doc.companionId,
  );

  const nationality =
    profile?.nationality || passportDoc?.countryCode || "";
  const passportExpiry = formatDateForInput(passportDoc?.expiresAt);
  const passportNumber = passportDoc?.documentNumber || "";
  const phone = profile?.phone || "";
  const email = user?.email || "";

  const hasAnyData = Boolean(
    givenName || surname || nationality || passportExpiry || passportNumber || phone,
  );

  return {
    givenName,
    surname,
    nationality: nationality.toUpperCase(),
    dateOfBirth: "",
    passportNumber,
    passportExpiry,
    phone,
    email,
    companionId: null,
    isAutoFilled: hasAnyData,
    sourceLabel: hasAnyData ? "Primary Profile & Vault" : undefined,
  };
}

export function resolveCompanionTraveller(
  companion: Companion,
  documents?: IdentityDocument[] | null,
): TravellerFormData {
  const { givenName, surname } = splitFullName(companion.fullName);

  // Companion documents if stored in vault
  const compDoc = (documents || []).find(
    (doc) =>
      doc.companionId === companion.id &&
      doc.type === "PASSPORT" &&
      doc.status === "ACTIVE",
  );

  const passportNumber =
    companion.passportNumber || compDoc?.documentNumber || "";
  const passportExpiry = formatDateForInput(
    companion.passportExpiry || compDoc?.expiresAt,
  );
  const dateOfBirth = formatDateForInput(companion.dateOfBirth);
  const nationality = compDoc?.countryCode || "";

  return {
    givenName,
    surname,
    nationality: nationality.toUpperCase(),
    dateOfBirth,
    passportNumber,
    passportExpiry,
    phone: "",
    email: "",
    companionId: companion.id,
    isAutoFilled: true,
    sourceLabel: companion.relationship
      ? `Saved Companion (${companion.relationship})`
      : "Saved Companion",
  };
}

export type TravellerSnapshot = {
  givenName: string;
  surname: string;
  fullName: string;
  nationality?: string;
  dateOfBirth?: string;
  passportNumber?: string;
  passportExpiry?: string;
  phone?: string;
  email?: string;
  [key: string]: unknown;
};

export function buildTravellerSnapshot(
  formData: TravellerFormData,
): TravellerSnapshot {
  const given = formData.givenName.trim();
  const sur = formData.surname.trim();
  const fullName = [given, sur].filter(Boolean).join(" ");

  const snapshot: TravellerSnapshot = {
    givenName: given,
    surname: sur,
    fullName,
  };

  if (formData.nationality.trim()) {
    snapshot.nationality = formData.nationality.trim().toUpperCase();
  }
  if (formData.dateOfBirth.trim()) {
    snapshot.dateOfBirth = formData.dateOfBirth.trim();
  }
  if (formData.passportNumber.trim()) {
    snapshot.passportNumber = formData.passportNumber.trim();
  }
  if (formData.passportExpiry.trim()) {
    snapshot.passportExpiry = formData.passportExpiry.trim();
  }
  if (formData.phone.trim()) {
    snapshot.phone = formData.phone.trim();
  }
  if (formData.email.trim()) {
    snapshot.email = formData.email.trim();
  }
  if (formData.companionId) {
    snapshot.companionId = formData.companionId;
  }

  return snapshot;
}

export function validateTravellerFormData(formData: TravellerFormData): {
  isValid: boolean;
  missingFields: string[];
} {
  const missing: string[] = [];

  if (!formData.givenName.trim()) {
    missing.push("givenName");
  }
  if (!formData.surname.trim()) {
    missing.push("surname");
  }

  return {
    isValid: missing.length === 0,
    missingFields: missing,
  };
}
