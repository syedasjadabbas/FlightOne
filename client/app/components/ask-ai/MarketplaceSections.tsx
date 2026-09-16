"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { OfferCard } from "@/lib/consultant/types";
import type {
  DriveDiscoveryCard,
  ExploreTile,
  RelatedSearchLink,
  StayDiscoveryCard,
} from "@/lib/ask-ai/resultsMarketplace";
import { hotelOfferImage } from "@/lib/ask-ai/marketplaceImages";
import { FLIGHTONE_BRAND, whatsappHref } from "@/lib/content/flightone";
import {
  DoodleGlobe,
  DoodleLuggage,
  DoodlePin,
  DoodleRoutePath,
  DoodleTicket,
} from "@/components/travel/TravelDoodles";

function MarketplaceCardMedia({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`results-market__card-media results-market__card-media--fallback ${className ?? ""}`.trim()}
        aria-hidden
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- curated Unsplash CDN tiles
    <img
      src={src}
      alt={alt}
      className={`results-market__card-media ${className ?? ""}`.trim()}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

function CarouselShell({
  ariaLabel,
  children,
}: {
  ariaLabel: string;
  children: React.ReactNode;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  function scrollBy(dir: -1 | 1) {
    const el = trackRef.current;
    if (!el) return;
    const step = Math.min(320, Math.max(220, el.clientWidth * 0.72));
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  }

  return (
    <div className="results-market__carousel-wrap">
      <button
        type="button"
        className="results-market__carousel-nav results-market__carousel-nav--prev"
        aria-label="Scroll left"
        onClick={() => scrollBy(-1)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M15 6l-6 6 6 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div ref={trackRef} className="results-market__carousel" role="list" aria-label={ariaLabel}>
        {children}
      </div>
      <button
        type="button"
        className="results-market__carousel-nav results-market__carousel-nav--next"
        aria-label="Scroll right"
        onClick={() => scrollBy(1)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M9 6l6 6-6 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}

function StripMotif({ motif }: { motif?: "stay" | "drive" | "explore" | "route" }) {
  if (!motif) return null;
  if (motif === "stay") return <DoodleLuggage className="results-market__strip-motif" size={16} />;
  if (motif === "drive") return <DoodleTicket className="results-market__strip-motif" size={22} />;
  if (motif === "explore") return <DoodlePin className="results-market__strip-motif" size={16} />;
  return <DoodleRoutePath className="results-market__strip-motif results-market__strip-motif--route" size={56} />;
}

function StripHeader({
  id,
  eyebrow,
  title,
  dates,
  actionLabel,
  onAction,
  actionDisabled,
  info,
  motif,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  dates?: string | null;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  info?: string;
  motif?: "stay" | "drive" | "explore" | "route";
}) {
  return (
    <div className="results-market__strip-head">
      <div className="results-market__strip-intro">
        {eyebrow ? (
          <p className="results-market__strip-eyebrow">
            <StripMotif motif={motif} />
            <span>{eyebrow}</span>
          </p>
        ) : null}
        <div className="results-market__strip-title-row">
          <h2 id={id} className="results-market__strip-title">
            <span className="results-market__strip-title-text">{title}</span>
            {info ? (
              <span className="results-market__strip-info" title={info} aria-label={info}>
                i
              </span>
            ) : null}
          </h2>
          {actionLabel ? (
            <button
              type="button"
              className="results-market__strip-action"
              onClick={onAction}
              disabled={actionDisabled || !onAction}
            >
              {actionLabel}
              <span aria-hidden>→</span>
            </button>
          ) : null}
        </div>
        {dates ? <p className="results-market__strip-dates">{dates}</p> : null}
      </div>
    </div>
  );
}

function StayOfferCard({
  offer,
  city,
  onViewOffer,
}: {
  offer: OfferCard;
  city?: string;
  onViewOffer: (offer: OfferCard) => void;
}) {
  return (
    <article role="listitem" className="results-market__tile results-market__tile--stay">
      <button type="button" className="results-market__tile-btn" onClick={() => onViewOffer(offer)}>
        <div className="results-market__tile-media">
          <MarketplaceCardMedia src={hotelOfferImage(city)} alt={offer.title} />
        </div>
        <div className="results-market__tile-body">
          <h3 className="results-market__tile-title">{offer.title}</h3>
          {offer.subtitle ? <p className="results-market__tile-meta">{offer.subtitle}</p> : null}
          <p className="results-market__tile-price">
            {offer.price}
            <span> / stay</span>
          </p>
        </div>
      </button>
    </article>
  );
}

function StayDiscoveryCardView({
  card,
  onSelect,
  disabled,
}: {
  card: StayDiscoveryCard;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <article role="listitem" className="results-market__tile results-market__tile--stay">
      <button type="button" className="results-market__tile-btn" onClick={onSelect} disabled={disabled}>
        <div className="results-market__tile-media">
          <MarketplaceCardMedia src={card.imageUrl} alt={card.imageAlt} />
        </div>
        <div className="results-market__tile-body">
          <h3 className="results-market__tile-title">{card.title}</h3>
          <p className="results-market__tile-meta">{card.subtitle}</p>
          <p className="results-market__tile-link">Search with Ava →</p>
        </div>
      </button>
    </article>
  );
}

function DriveDiscoveryCardView({
  card,
  onSelect,
  disabled,
}: {
  card: DriveDiscoveryCard;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <article role="listitem" className="results-market__tile results-market__tile--drive">
      <button type="button" className="results-market__tile-btn" onClick={onSelect} disabled={disabled}>
        <div className="results-market__tile-media results-market__tile-media--drive">
          <MarketplaceCardMedia src={card.imageUrl} alt={card.imageAlt} />
        </div>
        <div className="results-market__tile-body">
          <h3 className="results-market__tile-title">{card.category}</h3>
          <p className="results-market__tile-meta">{card.subtitle}</p>
        </div>
      </button>
    </article>
  );
}

function ExploreCarouselCard({
  tile,
  onSelect,
  disabled,
}: {
  tile: ExploreTile;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <article role="listitem" className="results-market__tile results-market__tile--explore">
      <button type="button" className="results-market__tile-btn" onClick={onSelect} disabled={disabled}>
        <div className="results-market__tile-media results-market__tile-media--explore">
          <MarketplaceCardMedia src={tile.imageUrl} alt={tile.imageAlt} />
          <span className="results-market__tile-overlay">
            <span className="results-market__tile-overlay-title">{tile.title}</span>
          </span>
        </div>
        <div className="results-market__tile-body">
          <p className="results-market__tile-meta">{tile.subtitle}</p>
        </div>
      </button>
    </article>
  );
}

export function StaysNearSection({
  city,
  dates,
  stays,
  discovery,
  onFindStays,
  onViewOffer,
  onDiscovery,
  disabled,
}: {
  city: string;
  dates?: string | null;
  stays: OfferCard[];
  discovery: StayDiscoveryCard[];
  onFindStays?: () => void;
  onViewOffer: (offer: OfferCard) => void;
  onDiscovery: (prompt: string) => void;
  disabled?: boolean;
}) {
  return (
    <section className="results-market__strip" aria-labelledby="results-stays-heading">
      <StripHeader
        id="results-stays-heading"
        eyebrow="Stay"
        title={`Stays near ${city}`}
        dates={dates}
        actionLabel="Find stays"
        onAction={onFindStays}
        actionDisabled={disabled || !onFindStays}
        info="Live hotel results appear when Ava searches stays for this trip. No placeholder prices."
        motif="stay"
      />
      <CarouselShell ariaLabel={`Stays near ${city}`}>
        {stays.length > 0
          ? stays.slice(0, 8).map((offer) => (
              <StayOfferCard key={offer.id} offer={offer} city={city} onViewOffer={onViewOffer} />
            ))
          : discovery.map((card) => (
              <StayDiscoveryCardView
                key={card.id}
                card={card}
                disabled={disabled}
                onSelect={() => onDiscovery(card.prompt)}
              />
            ))}
      </CarouselShell>
    </section>
  );
}

export function DriveAroundSection({
  city,
  dates,
  cards,
  onFindCars,
  onDiscovery,
  disabled,
}: {
  city: string;
  dates?: string | null;
  cards: DriveDiscoveryCard[];
  onFindCars?: () => void;
  onDiscovery: (prompt: string) => void;
  disabled?: boolean;
}) {
  return (
    <section className="results-market__strip" aria-labelledby="results-drive-heading">
      <StripHeader
        id="results-drive-heading"
        eyebrow="Drive"
        title={`Drive around in ${city}`}
        dates={dates}
        actionLabel="Find cars"
        onAction={onFindCars}
        actionDisabled={disabled || !onFindCars}
        info="Car hire is searched on request through Ava — category tiles are starting points, not live quotes."
        motif="drive"
      />
      <CarouselShell ariaLabel={`Car hire near ${city}`}>
        {cards.map((card) => (
          <DriveDiscoveryCardView
            key={card.id}
            card={card}
            disabled={disabled}
            onSelect={() => onDiscovery(card.prompt)}
          />
        ))}
      </CarouselShell>
    </section>
  );
}

export function ExploreNearSection({
  city,
  tiles,
  onSelect,
  disabled,
}: {
  city: string;
  tiles: ExploreTile[];
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}) {
  if (tiles.length === 0) return null;

  return (
    <section className="results-market__strip" aria-labelledby="results-explore-heading">
      <StripHeader
        id="results-explore-heading"
        eyebrow="Explore"
        title={`Explore ${city}`}
        dates="Nearby airports and places FlightOne can search from your origin."
        motif="explore"
      />
      <CarouselShell ariaLabel={`Explore ${city}`}>
        {tiles.map((tile) => (
          <ExploreCarouselCard
            key={tile.id}
            tile={tile}
            disabled={disabled}
            onSelect={() => onSelect(tile.prompt)}
          />
        ))}
      </CarouselShell>
    </section>
  );
}

export function RelatedRoutesSection({
  links,
  onSelect,
  disabled,
}: {
  links: RelatedSearchLink[];
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}) {
  if (links.length === 0) return null;

  return (
    <section className="results-market__related-strip" aria-labelledby="results-related-heading">
      <div className="results-market__related-head">
        <p className="results-market__strip-eyebrow">
          <DoodleGlobe className="results-market__strip-motif" size={16} />
          <span>More searches</span>
        </p>
        <h2 id="results-related-heading" className="results-market__related-title">
          <span className="results-market__strip-title-text">Related routes</span>
          <DoodleRoutePath className="results-market__related-route" size={64} />
        </h2>
      </div>
      <ul className="results-market__related-row">
        {links.map((link) => (
          <li key={link.id}>
            <button
              type="button"
              className="results-market__related-chip"
              onClick={() => onSelect(link.prompt)}
              disabled={disabled}
            >
              <span>{link.label}</span>
              <span className="results-market__related-chip-arrow" aria-hidden>
                →
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function MarketplaceDisclaimer() {
  return (
    <div className="results-market__disclaimer">
      <p>
        Flight prices and availability come from Travelport and can change until you book. Baggage,
        seat selection, and airline change fees may apply — confirm with the airline before
        travelling.
      </p>
      <p>
        Hotel and car suggestions start an Ava search — they are not live inventory unless marked
        with a price from your results.
      </p>
    </div>
  );
}

function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M19.05 4.91A9.82 9.82 0 0 0 12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.91-7.01zm-7.01 15.24h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.23 8.23 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.55-3.7 8.23-8.24 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.79.97-.15.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.15-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.15.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.42h-.48c-.17 0-.43.06-.66.31-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74 1.48.64 2.07.7 2.81.59.43-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.17-.48-.29z"
      />
    </svg>
  );
}

export function MarketplaceFooter({
  city,
  onAskStays,
}: {
  city?: string;
  onAskStays?: () => void;
}) {
  const year = new Date().getFullYear();

  return (
    <footer className="results-market__footer">
      <div className="results-market__footer-glow" aria-hidden="true" />

      <div className="results-market__footer-shell">
        <div className="results-market__footer-brand">
          <div className="results-market__footer-brand-copy">
            <p className="results-market__footer-wordmark">
              Flight<span>One</span>
            </p>
            <p className="results-market__footer-tagline">{FLIGHTONE_BRAND.tagline}</p>
            <p className="results-market__footer-promise">{FLIGHTONE_BRAND.promise}</p>
          </div>
          <div className="results-market__footer-cta">
            <a
              href={whatsappHref()}
              target="_blank"
              rel="noopener noreferrer"
              className="results-market__footer-whatsapp"
            >
              <WhatsAppGlyph className="results-market__footer-whatsapp-icon" />
              Chat on WhatsApp
            </a>
            <p className="results-market__footer-cta-note">Usually replies within a few minutes</p>
          </div>
        </div>

        <div className="results-market__footer-grid">
          <div className="results-market__footer-col">
            <p className="results-market__footer-heading">Company</p>
            <Link href="/chat">About FlightOne</Link>
            <Link href="/chat">How Ava works</Link>
            <Link href="/chat">Custom packages</Link>
          </div>
          <div className="results-market__footer-col">
            <p className="results-market__footer-heading">Travel</p>
            <Link href="/chat">Flights</Link>
            {onAskStays && city ? (
              <button type="button" onClick={onAskStays}>
                Stays in {city}
              </button>
            ) : (
              <Link href="/chat">Stays</Link>
            )}
            <Link href="/chat">Chat with Ava</Link>
            <Link href="/login?redirect=/chat">Sign in</Link>
          </div>
          <div className="results-market__footer-col">
            <p className="results-market__footer-heading">Contact</p>
            <a href={whatsappHref()} target="_blank" rel="noopener noreferrer">
              WhatsApp
            </a>
            <a href={`mailto:${FLIGHTONE_BRAND.email}`}>{FLIGHTONE_BRAND.email}</a>
            <a href={`tel:${FLIGHTONE_BRAND.phoneE164}`}>{FLIGHTONE_BRAND.phoneDisplay}</a>
          </div>
          <div className="results-market__footer-col results-market__footer-col--meta">
            <p className="results-market__footer-heading">Visit</p>
            <div className="results-market__footer-meta">
              <span className="results-market__footer-meta-label">Hours</span>
              <span className="results-market__footer-static">{FLIGHTONE_BRAND.hours}</span>
            </div>
            <div className="results-market__footer-meta">
              <span className="results-market__footer-meta-label">Office</span>
              <span className="results-market__footer-static">{FLIGHTONE_BRAND.address}</span>
            </div>
          </div>
        </div>

        <div className="results-market__footer-legal">
          <p className="results-market__footer-copy">
            © {year} {FLIGHTONE_BRAND.name}. Flight prices from Travelport.
          </p>
          <div className="results-market__footer-legal-links">
            <Link href="/chat">Privacy</Link>
            <span className="results-market__footer-sep" aria-hidden>
              ·
            </span>
            <Link href="/chat">Terms</Link>
            <span className="results-market__footer-sep" aria-hidden>
              ·
            </span>
            <a href={whatsappHref()} target="_blank" rel="noopener noreferrer">
              Support
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
