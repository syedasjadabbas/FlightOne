"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { Button, Input, SearchableSelect } from "@/components/ui";
import { TravellerSection } from "@/app/components/traveller";
import {
  POPULAR_DESTINATIONS,
  POPULAR_NATIONALITIES,
  PURPOSE_OPTIONS,
} from "./visaContent";
import { VisaIsoPicks } from "./VisaIsoPicks";

export type VisaAssessFormProps = {
  destination: string;
  nationality: string;
  transit: string;
  purpose: string;
  departDate: string;
  returnDate: string;
  assessing: boolean;
  canLookup: boolean;
  error: string | null;
  onDestination: (v: string) => void;
  onNationality: (v: string) => void;
  onTransit: (v: string) => void;
  onPurpose: (v: string) => void;
  onDepartDate: (v: string) => void;
  onReturnDate: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
};

export function VisaAssessForm({
  destination,
  nationality,
  transit,
  purpose,
  departDate,
  returnDate,
  assessing,
  canLookup,
  error,
  onDestination,
  onNationality,
  onTransit,
  onPurpose,
  onDepartDate,
  onReturnDate,
  onSubmit,
}: VisaAssessFormProps) {
  return (
    <TravellerSection title="Check requirements" panel>
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Input
              label="Destination (ISO2)"
              value={destination}
              onChange={(e) => onDestination(e.target.value.toUpperCase())}
              maxLength={2}
              placeholder="e.g. AE, TR, GB"
            />
            <VisaIsoPicks
              label="Common"
              items={POPULAR_DESTINATIONS.slice(0, 6)}
              value={destination}
              onChange={onDestination}
            />
          </div>
          <div>
            <Input
              label="Passport nationality (ISO2)"
              value={nationality}
              onChange={(e) => onNationality(e.target.value.toUpperCase())}
              maxLength={2}
              placeholder="e.g. PK, IN, US"
            />
            <VisaIsoPicks
              label="Common"
              items={POPULAR_NATIONALITIES.slice(0, 6)}
              value={nationality}
              onChange={onNationality}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <SearchableSelect
            label="Travel purpose"
            options={[...PURPOSE_OPTIONS]}
            value={purpose}
            onChange={(v) => onPurpose(String(v))}
            searchable={false}
          />
          <Input
            label="Departure (optional)"
            type="date"
            value={departDate}
            onChange={(e) => onDepartDate(e.target.value)}
          />
          <Input
            label="Return (optional)"
            type="date"
            value={returnDate}
            onChange={(e) => onReturnDate(e.target.value)}
          />
        </div>

        <Input
          label="Transit countries (optional, comma-separated ISO2)"
          value={transit}
          onChange={(e) => onTransit(e.target.value.toUpperCase())}
          placeholder="e.g. QA, TR, DE"
        />

        <div className="fo-visa__form-actions">
          <Button type="submit" size="sm" disabled={assessing || !canLookup}>
            {assessing ? "Evaluating…" : "Evaluate requirements"}
          </Button>
          <Link href="/chat">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              icon={<MessageCircle size={14} aria-hidden />}
            >
              Ask Ava
            </Button>
          </Link>
        </div>
      </form>
      {error ? (
        <p className="fo-visa__error" role="alert">
          {error}
        </p>
      ) : null}
    </TravellerSection>
  );
}
