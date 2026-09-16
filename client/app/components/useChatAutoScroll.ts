"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const BOTTOM_THRESHOLD_PX = 96;

/** WhatsApp-style scroll: follow new messages when near bottom; offer jump control when not. */
export function useChatAutoScroll(deps: {
  messageCount: number;
  lastMessageRole?: "user" | "assistant";
  lastMessageLength: number;
  busy: boolean;
  resultsTick: number;
  searchPhase?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const prevCountRef = useRef(deps.messageCount);
  const prevBusyRef = useRef(deps.busy);

  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const isNearBottom = useCallback(() => {
    const root = scrollRef.current;
    if (!root) return true;
    const distance = root.scrollHeight - root.scrollTop - root.clientHeight;
    return distance <= BOTTOM_THRESHOLD_PX;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const root = scrollRef.current;
    if (!root) return;
    root.scrollTo({ top: root.scrollHeight, behavior });
  }, []);

  const jumpToLatest = useCallback(() => {
    pinnedRef.current = true;
    setShowJumpToLatest(false);
    scrollToBottom("smooth");
  }, [scrollToBottom]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;

    const onScroll = () => {
      const near = isNearBottom();
      pinnedRef.current = near;
      setShowJumpToLatest(!near);
    };

    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, [isNearBottom]);

  useEffect(() => {
    const grew = deps.messageCount > prevCountRef.current;
    const userSent = grew && deps.lastMessageRole === "user";
    const responseFinished = prevBusyRef.current && !deps.busy;

    if (userSent) {
      pinnedRef.current = true;
      setShowJumpToLatest(false);
    }

    if (pinnedRef.current && (grew || responseFinished || deps.busy)) {
      const behavior: ScrollBehavior =
        userSent || responseFinished ? "smooth" : deps.busy ? "auto" : "smooth";
      requestAnimationFrame(() => {
        requestAnimationFrame(() => scrollToBottom(behavior));
      });
    } else if (grew) {
      setShowJumpToLatest(true);
    }

    prevCountRef.current = deps.messageCount;
    prevBusyRef.current = deps.busy;
  }, [
    deps.messageCount,
    deps.lastMessageRole,
    deps.lastMessageLength,
    deps.busy,
    deps.resultsTick,
    deps.searchPhase,
    scrollToBottom,
  ]);

  return {
    scrollRef,
    bottomRef,
    showJumpToLatest,
    jumpToLatest,
  };
}
