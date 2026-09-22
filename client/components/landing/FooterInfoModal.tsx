'use client';

import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import Link from 'next/link';
import {
  FLIGHTONE_FAQS,
  FLIGHTONE_PILLARS,
  FLIGHTONE_BRAND,
  whatsappHref,
} from '@/lib/content/flightone';

export type FooterInfoTopic =
  | 'why-choose-us'
  | 'transparent-pricing'
  | 'faq'
  | 'customer-support'
  | 'refund-policies';

const REFUND_FAQS = [
  {
    q: 'How are refund amounts calculated?',
    a: 'From stored fare rules and supplier penalties only — never invented fees. Open a case and we show the full breakdown before you approve anything.',
  },
  {
    q: 'How long do refunds take?',
    a: 'After the airline approves: card and wallet refunds typically take 5–10 business days; bank transfer (IBFT) within about 3 business days.',
  },
  {
    q: 'Can I get a travel credit instead of a refund?',
    a: 'Depending on the fare rules, yes — travel credits are issued instead of, or alongside, a cash refund when that is the better option for your ticket.',
  },
];

function TopicContent({ topic }: { topic: FooterInfoTopic }) {
  switch (topic) {
    case 'why-choose-us':
      return (
        <div className="footer-modal__pillars">
          {FLIGHTONE_PILLARS.map((p) => (
            <div key={p.title} className="footer-modal__pillar">
              <h3 className="footer-modal__pillar-title">{p.title}</h3>
              <p className="footer-modal__pillar-body">{p.body}</p>
            </div>
          ))}
        </div>
      );
    case 'transparent-pricing':
      return (
        <div className="footer-modal__pillars">
          <div className="footer-modal__pillar">
            <h3 className="footer-modal__pillar-title">
              {FLIGHTONE_PILLARS[1].title}
            </h3>
            <p className="footer-modal__pillar-body">{FLIGHTONE_PILLARS[1].body}</p>
          </div>
          {FLIGHTONE_FAQS.filter((f) =>
            /pricing|payment|deposit/i.test(f.q),
          ).map((f) => (
            <div key={f.q} className="footer-modal__pillar">
              <h3 className="footer-modal__pillar-title">{f.q}</h3>
              <p className="footer-modal__pillar-body">{f.a}</p>
            </div>
          ))}
        </div>
      );
    case 'faq':
      return (
        <div className="footer-modal__faqs">
          {FLIGHTONE_FAQS.map((f) => (
            <details key={f.q} className="footer-modal__faq">
              <summary className="footer-modal__faq-q">{f.q}</summary>
              <p className="footer-modal__faq-a">{f.a}</p>
            </details>
          ))}
          <p className="footer-modal__more">
            <Link href="/support">Browse the full support topic library →</Link>
          </p>
        </div>
      );
    case 'refund-policies':
      return (
        <div className="footer-modal__faqs">
          {REFUND_FAQS.map((f) => (
            <details key={f.q} className="footer-modal__faq">
              <summary className="footer-modal__faq-q">{f.q}</summary>
              <p className="footer-modal__faq-a">{f.a}</p>
            </details>
          ))}
          <p className="footer-modal__more">
            <Link href="/refunds">Open a refund case →</Link>
          </p>
        </div>
      );
    case 'customer-support':
      return (
        <div className="footer-modal__contact">
          <p className="footer-modal__contact-lede">
            Talk to a real consultant — chat first for quick questions, or open a
            case when you need a human to review a booking.
          </p>
          <div className="footer-modal__contact-grid">
            <a
              href={whatsappHref()}
              target="_blank"
              rel="noopener noreferrer"
              className="footer-modal__contact-card"
            >
              <span className="footer-modal__contact-card-title">WhatsApp</span>
              <span className="footer-modal__contact-card-hint">
                Avg. response ~15 mins
              </span>
            </a>
            <Link href="/chat" className="footer-modal__contact-card">
              <span className="footer-modal__contact-card-title">Chat with Ava</span>
              <span className="footer-modal__contact-card-hint">
                Instant trip questions
              </span>
            </Link>
            <Link href="/escalations" className="footer-modal__contact-card">
              <span className="footer-modal__contact-card-title">Open a case</span>
              <span className="footer-modal__contact-card-hint">
                Track a consultant review
              </span>
            </Link>
            <a
              href={`mailto:${FLIGHTONE_BRAND.email}`}
              className="footer-modal__contact-card"
            >
              <span className="footer-modal__contact-card-title">Email</span>
              <span className="footer-modal__contact-card-hint">
                {FLIGHTONE_BRAND.email}
              </span>
            </a>
          </div>
        </div>
      );
    default:
      return null;
  }
}

const TOPIC_TITLE: Record<FooterInfoTopic, string> = {
  'why-choose-us': 'Why choose FlightOne',
  'transparent-pricing': 'Transparent pricing',
  faq: 'Frequently asked questions',
  'customer-support': 'Customer support',
  'refund-policies': 'Refund policies',
};

export function FooterInfoModal({
  topic,
  onClose,
}: {
  topic: FooterInfoTopic | null;
  onClose: () => void;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!topic) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [topic, onClose]);

  if (!topic || typeof document === 'undefined') return null;

  return createPortal(
    <div className="footer-modal__overlay" role="presentation" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="footer-modal__panel"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="footer-modal__head">
          <h2 id={titleId} className="footer-modal__title">
            {TOPIC_TITLE[topic]}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="footer-modal__close"
            aria-label="Close"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </header>
        <div className="footer-modal__body">
          <TopicContent topic={topic} />
        </div>
      </div>

      <style>{`
        .footer-modal__overlay {
          position: fixed;
          inset: 0;
          z-index: 200;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 5vh 5vw;
          background: rgba(2, 6, 21, 0.55);
          backdrop-filter: blur(3px);
          animation: footer-modal-fade-in 0.18s ease both;
        }

        .footer-modal__panel {
          position: relative;
          width: 90vw;
          height: 90vh;
          max-width: 72rem;
          display: flex;
          flex-direction: column;
          border-radius: 1.5rem;
          background: #ffffff;
          box-shadow:
            0 32px 80px -20px rgba(14, 22, 32, 0.35),
            0 1px 3px rgba(14, 22, 32, 0.05),
            inset 0 1px 0 #ffffff;
          overflow: hidden;
          animation: footer-modal-rise-in 0.22s cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .footer-modal__head {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid rgba(14, 22, 32, 0.08);
        }

        .footer-modal__title {
          margin: 0;
          font-family: var(--font-hero, var(--font-display));
          font-size: clamp(1.25rem, 2.4vw, 1.6rem);
          font-weight: 700;
          letter-spacing: -0.02em;
          color: var(--navy);
        }

        .footer-modal__close {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 2.25rem;
          height: 2.25rem;
          flex-shrink: 0;
          border: none;
          border-radius: 9999px;
          background: color-mix(in oklab, var(--line) 40%, white);
          color: var(--ink-soft);
          cursor: pointer;
          box-shadow: inset 0 1px 0 #ffffff;
          transition: color 0.15s ease, box-shadow 0.15s ease;
        }

        .footer-modal__close:hover {
          color: var(--navy);
          box-shadow: 0 2px 8px rgba(14, 22, 32, 0.08), inset 0 1px 0 #ffffff;
        }

        .footer-modal__body {
          flex: 1 1 auto;
          min-height: 0;
          overflow-y: auto;
          padding: 1.75rem 1.5rem 2.5rem;
        }

        .footer-modal__pillars {
          display: grid;
          gap: 1rem;
          grid-template-columns: 1fr;
        }

        @media (min-width: 640px) {
          .footer-modal__pillars {
            grid-template-columns: 1fr 1fr;
          }
        }

        .footer-modal__pillar {
          padding: 1.1rem 1.2rem;
          border-radius: 1rem;
          background: color-mix(in oklab, var(--horizon-cool, #eef4f6) 55%, white);
          box-shadow: inset 0 1px 0 #ffffff;
        }

        .footer-modal__pillar-title {
          margin: 0 0 0.4rem;
          font-family: var(--font-hero, var(--font-display));
          font-size: 1rem;
          font-weight: 700;
          color: var(--navy);
        }

        .footer-modal__pillar-body {
          margin: 0;
          font-size: 0.9rem;
          line-height: 1.55;
          color: var(--ink-soft);
        }

        .footer-modal__faqs {
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
          max-width: 46rem;
        }

        .footer-modal__faq {
          border-radius: 1rem;
          background: color-mix(in oklab, var(--horizon-cool, #eef4f6) 45%, white);
          box-shadow: inset 0 1px 0 #ffffff;
          padding: 0.15rem 1.1rem;
        }

        .footer-modal__faq-q {
          cursor: pointer;
          list-style: none;
          padding: 0.85rem 0;
          font-weight: 600;
          font-size: 0.9375rem;
          color: var(--navy);
        }

        .footer-modal__faq-q::-webkit-details-marker {
          display: none;
        }

        .footer-modal__faq-a {
          margin: 0 0 0.9rem;
          font-size: 0.875rem;
          line-height: 1.6;
          color: var(--ink-soft);
        }

        .footer-modal__more {
          margin: 0.5rem 0 0;
          font-size: 0.875rem;
        }

        .footer-modal__more a {
          font-weight: 600;
          color: var(--sky);
        }

        .footer-modal__contact-lede {
          margin: 0 0 1.25rem;
          max-width: 40rem;
          font-size: 0.9375rem;
          line-height: 1.6;
          color: var(--ink-soft);
        }

        .footer-modal__contact-grid {
          display: grid;
          gap: 0.85rem;
          grid-template-columns: 1fr;
        }

        @media (min-width: 640px) {
          .footer-modal__contact-grid {
            grid-template-columns: 1fr 1fr;
          }
        }

        .footer-modal__contact-card {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
          padding: 1.1rem 1.2rem;
          border-radius: 1rem;
          background: color-mix(in oklab, var(--horizon-cool, #eef4f6) 55%, white);
          box-shadow: 0 2px 8px rgba(14, 22, 32, 0.04), inset 0 1px 0 #ffffff;
          text-decoration: none;
          transition: box-shadow 0.15s ease, transform 0.12s ease;
        }

        .footer-modal__contact-card:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(14, 22, 32, 0.08), inset 0 1px 0 #ffffff;
        }

        .footer-modal__contact-card-title {
          font-weight: 700;
          font-size: 0.9375rem;
          color: var(--navy);
        }

        .footer-modal__contact-card-hint {
          font-size: 0.8125rem;
          color: var(--ink-faint);
        }

        @keyframes footer-modal-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes footer-modal-rise-in {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @media (prefers-reduced-motion: reduce) {
          .footer-modal__overlay,
          .footer-modal__panel {
            animation: none;
          }
        }
      `}</style>
    </div>,
    document.body,
  );
}
