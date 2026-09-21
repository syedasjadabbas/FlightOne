"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function GroupInviteCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard may be blocked; leave UI unchanged */
    }
  }

  return (
    <div className="fo-gm-invite-code">
      <span className="fo-gm-invite-code__label">Invite code</span>
      <code className="fo-gm-invite-code__value">{code}</code>
      <button
        type="button"
        className="fo-gm-invite-code__copy"
        onClick={() => void handleCopy()}
        aria-label={copied ? "Invite code copied" : "Copy invite code"}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <Copy className="h-3.5 w-3.5" aria-hidden />
        )}
        <span>{copied ? "Copied" : "Copy"}</span>
      </button>
    </div>
  );
}
