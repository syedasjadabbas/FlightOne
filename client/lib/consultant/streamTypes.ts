import type { SearchResultsPayload } from "@/lib/ask-ai/types";
import type { ConsultantResponse, ExtractedIntent, OfferCard } from "./types";

export type ConsultantStreamEvent =
  | { type: "status"; phase: "extract" | "search" | "reply" | "done" }
  | {
      type: "offers";
      offers: OfferCard[];
      intent: ExtractedIntent;
      meta: ConsultantResponse["meta"];
      whatsappUrl?: string;
    }
  | { type: "searchResults" } & SearchResultsPayload
  | { type: "token"; delta: string }
  | { type: "done"; result: ConsultantResponse }
  | { type: "error"; message: string };

export type ConsultantStatusPhase = Extract<
  ConsultantStreamEvent,
  { type: "status" }
>["phase"];

export type ConsultantStreamSink = {
  onStatus?: (phase: ConsultantStatusPhase) => void;
  onOffers?: (payload: {
    offers: OfferCard[];
    intent: ExtractedIntent;
    meta: ConsultantResponse["meta"];
    whatsappUrl?: string;
  }) => void;
  onSearchResults?: (payload: SearchResultsPayload) => void;
  onToken?: (delta: string) => void;
};
