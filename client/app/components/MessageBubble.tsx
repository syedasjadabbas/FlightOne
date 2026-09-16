"use client";

import type { ReactNode } from "react";
import type { UiMessage } from "./chat.types";
import { isTravelSearchError } from "./chat/SearchErrorFooter";

export type { UiMessage };
export { isTravelSearchError };

export function MessageBubble({
  message,
  index = 0,
  hideWelcome = false,
  showIdentity = true,
  identityFull = true,
  footer,
}: {
  message: UiMessage;
  index?: number;
  /** Hide the seed greeting on the landing hero so the headline leads. */
  hideWelcome?: boolean;
  /** First assistant turn in a contiguous run shows identity; later ones omit. */
  showIdentity?: boolean;
  /** Full “Ava · Travel consultant” vs short “Ava”. */
  identityFull?: boolean;
  /** Optional block below message text (e.g. View results / Try again CTA). */
  footer?: ReactNode;
}) {
  const isUser = message.role === "user";
  const isError = !isUser && message.content ? isTravelSearchError(message.content) : false;
  /** First turn only — avoid staggered cascade that reads as template motion. */
  const animate = index === 0;

  if (!message.content && !footer) return null;
  if (hideWelcome && !isUser && !footer) return null;

  return (
    <div
      className={`message-row message-row--${isUser ? "user" : "assistant"} flex flex-col ${
        isUser ? "items-end" : "items-start"
      } ${animate ? "msg-enter" : ""}`}
    >
      {!isUser && showIdentity ? (
        <span className="message-row__label mb-1.5 pl-1">
          Ava
          {identityFull ? (
            <span className="chat-page__ava-role">Travel consultant</span>
          ) : null}
        </span>
      ) : null}
      <div
        className={`message-bubble whitespace-pre-wrap text-[15px] leading-[1.58] tracking-[-0.01em] ${
          isUser
            ? "message-bubble--user"
            : `message-bubble--assistant${isError ? " message-bubble--error" : ""}`
        }`}
      >
        {message.content ? (
          <div className="message-bubble__text">
            {isError ? (
              <>
                <p className="search-error-footer__eyebrow message-bubble__error-eyebrow">
                  Live search unavailable
                </p>
                <p className="message-bubble__error-body">{message.content}</p>
              </>
            ) : (
              message.content
            )}
          </div>
        ) : null}
        {footer ? (
          <div
            className={`results-msg-cta-wrap ${message.content ? "message-bubble__footer" : ""}`}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
