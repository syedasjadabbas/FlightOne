"use client";

import Link from "next/link";
import { CheckCircle2, MessageCircle, UserRound } from "lucide-react";
import { Button } from "@/components/ui";
import { TravellerSection } from "@/app/components/traveller";

export function VisaSpecialistSupport({
  isAuthenticated,
  escalating,
  escalateMsg,
  onEscalate,
}: {
  isAuthenticated: boolean;
  escalating: boolean;
  escalateMsg: string | null;
  onEscalate: () => void;
}) {
  return (
    <TravellerSection title="Specialist support" panel>
      <p className="fo-visa__desk-copy">
        Need end-to-end processing, appointment scheduling, document checks, or corporate
        delegation? Route the case to a FlightOne visa consultant.
      </p>

      {escalateMsg ? (
        <div className="fo-visa__confirm" role="status">
          <CheckCircle2 size={16} className="fo-visa__confirm-icon" aria-hidden />
          <p>{escalateMsg}</p>
        </div>
      ) : (
        <div className="fo-visa__desk-actions">
          {isAuthenticated ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={escalating}
              onClick={onEscalate}
              icon={<UserRound size={14} aria-hidden />}
            >
              {escalating ? "Connecting…" : "Request specialist review"}
            </Button>
          ) : (
            <Link href="/login?redirect=%2Fvisa">
              <Button type="button" size="sm" variant="secondary">
                Sign in for specialist review
              </Button>
            </Link>
          )}
          <Link href="/chat">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              icon={<MessageCircle size={14} aria-hidden />}
            >
              Open Ava chat
            </Button>
          </Link>
        </div>
      )}
    </TravellerSection>
  );
}
