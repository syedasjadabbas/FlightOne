import Link from "next/link";
import {
  Compass,
  Lock,
  Mail,
  MessageSquare,
  Phone,
  Shield,
} from "lucide-react";
import { FLIGHTONE_BRAND, whatsappHref } from "@/lib/content/flightone";

type SiteChromeFooterProps = {
  /** Auth screens: quieter bar under the form column. */
  variant?: "app" | "auth";
};

function InfinityMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="22"
      height="16"
      viewBox="0 0 44 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M12.5 7.5C7.253 7.5 3 11.753 3 17C3 22.247 7.253 26.5 12.5 26.5C18.5 26.5 24 16.5 31.5 16.5C36.747 16.5 41 20.753 41 26"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M31.5 26.5C36.747 26.5 41 22.247 41 17C41 11.753 36.747 7.5 31.5 7.5C25.5 7.5 20 17.5 12.5 17.5C7.253 17.5 3 13.247 3 8"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Standard production-grade footer for traveller / desk / auth chrome.
 */
export function SiteChromeFooter({ variant = "app" }: SiteChromeFooterProps) {
  const year = new Date().getFullYear();

  if (variant === "auth") {
    return (
      <footer className="fo-chrome-footer fo-chrome-footer--auth">
        <div className="fo-chrome-footer__inner">
          <div className="flex items-center gap-2">
            <span className="text-navy flex items-center">
              <InfinityMark />
            </span>
            <p className="fo-chrome-footer__brand">
              <span className="fo-chrome-footer__flight">Flight</span>
              <span className="fo-chrome-footer__accent">One</span>
            </p>
          </div>
          <p className="fo-chrome-footer__copy">
            © {year} {FLIGHTONE_BRAND.shortName} · All rights reserved.
          </p>
          <nav className="fo-chrome-footer__links" aria-label="Footer">
            <Link href="/chat">
              <MessageSquare size={13} strokeWidth={2} />
              <span>Support</span>
            </Link>
            <a href={whatsappHref()} target="_blank" rel="noopener noreferrer">
              <Phone size={13} strokeWidth={2} />
              <span>WhatsApp</span>
            </a>
            <a href={`mailto:${FLIGHTONE_BRAND.email}`}>
              <Mail size={13} strokeWidth={2} />
              <span>Email</span>
            </a>
          </nav>
        </div>
      </footer>
    );
  }

  return (
    <footer className="fo-chrome-footer">
      <div className="fo-chrome-footer__inner">
        {/* Brand & System Status Left */}
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-2.5">
            <span className="text-navy flex items-center">
              <InfinityMark />
            </span>
            <p className="fo-chrome-footer__brand">
              <span className="fo-chrome-footer__flight">Flight</span>
              <span className="fo-chrome-footer__accent">One</span>
            </p>
          </div>

          <p className="fo-chrome-footer__copy hidden sm:inline-block">
            © {year} {FLIGHTONE_BRAND.shortName} · All rights reserved.
          </p>
        </div>

        {/* Links Right */}
        <nav className="fo-chrome-footer__links" aria-label="Footer">
          <Link href="/chat" className="fo-chrome-footer__link-pill">
            <MessageSquare size={13} strokeWidth={2} />
            <span>Chat</span>
          </Link>
          <Link href="/journey" className="fo-chrome-footer__link-pill">
            <Compass size={13} strokeWidth={2} />
            <span>My Journey</span>
          </Link>
          <Link href="/vault" className="fo-chrome-footer__link-pill">
            <Shield size={13} strokeWidth={2} />
            <span>Vault</span>
          </Link>
          <a
            href={whatsappHref()}
            target="_blank"
            rel="noopener noreferrer"
            className="fo-chrome-footer__link-pill"
          >
            <Phone size={13} strokeWidth={2} />
            <span>WhatsApp</span>
          </a>
          <a
            href={`mailto:${FLIGHTONE_BRAND.email}`}
            className="fo-chrome-footer__link-pill"
          >
            <Mail size={13} strokeWidth={2} />
            <span>Support</span>
          </a>
        </nav>
      </div>
    </footer>
  );
}
