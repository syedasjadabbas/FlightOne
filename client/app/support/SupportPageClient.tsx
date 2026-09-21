"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui";
import { TravellerPageHeader } from "@/app/components/traveller";
import {
  SupportPathStrip,
  SupportRelatedDesks,
  SupportTopicAccordion,
} from "./_components";

export function SupportPageClient() {
  return (
    <div className="fo-support">
      <TravellerPageHeader
        title="Support"
        lede="Answers first. Chat with Ava for trip questions, or open a case when you need a consultant."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/chat">
              <Button variant="secondary" size="sm" className="inline-flex items-center gap-1.5">
                <MessageCircle size={14} aria-hidden />
                Chat with Ava
              </Button>
            </Link>
            <Link href="/escalations">
              <Button variant="ghost" size="sm">
                My cases
              </Button>
            </Link>
          </div>
        }
      />

      <SupportPathStrip />
      <SupportTopicAccordion />
      <SupportRelatedDesks />
    </div>
  );
}
