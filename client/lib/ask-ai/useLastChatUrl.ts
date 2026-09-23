"use client";

import { useSyncExternalStore } from "react";
import { lastChatUrl } from "./chatUrlState";

// sessionStorage has no change event within a tab, and the value only matters
// at click time on a page that did not write it — nothing to subscribe to.
const subscribe = () => () => {};

/**
 * Last /chat URL this tab was on (conversation + results + open deal), for
 * "Back to search" links. Server render gets plain "/chat"; the client swaps
 * in the stored URL without a hydration mismatch.
 */
export function useLastChatUrl(): string {
  return useSyncExternalStore(subscribe, lastChatUrl, () => "/chat");
}
