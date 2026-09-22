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
            <img src="/images/logo-dark.png" alt="FlightOne" className="h-4 w-auto" />
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
            <img src="/images/logo-dark.png" alt="FlightOne" className="h-4 w-auto" />
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
