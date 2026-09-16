import Link from "next/link";
import { FLIGHTONE_BRAND, whatsappHref } from "@/lib/content/flightone";

type SiteChromeFooterProps = {
  /** Auth screens: quieter bar under the form column. */
  variant?: "app" | "auth";
};

/**
 * Light page footer for traveller / desk / auth chrome.
 * Marketplace results keep the full MarketplaceFooter instead.
 */
export function SiteChromeFooter({ variant = "app" }: SiteChromeFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer
      className={
        variant === "auth"
          ? "fo-chrome-footer fo-chrome-footer--auth"
          : "fo-chrome-footer"
      }
    >
      <div className="fo-chrome-footer__inner">
        <p className="fo-chrome-footer__brand">
          <span className="fo-chrome-footer__flight">Flight</span>
          <span className="fo-chrome-footer__accent">One</span>
        </p>
        <p className="fo-chrome-footer__copy">
          © {year} {FLIGHTONE_BRAND.shortName}
        </p>
        <nav className="fo-chrome-footer__links" aria-label="Footer">
          <Link href="/chat">Chat</Link>
          <a href={whatsappHref()} target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>
          <a href={`mailto:${FLIGHTONE_BRAND.email}`}>Email</a>
        </nav>
      </div>
    </footer>
  );
}
