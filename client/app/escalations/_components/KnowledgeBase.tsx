"use client";

import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui";
import type { SupportCategory } from "./supportContent";

export function KnowledgeBase({
  categories,
  searchQuery,
  onSearchChange,
  expandedFaq,
  onToggleFaq,
}: {
  categories: SupportCategory[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
  expandedFaq: string | null;
  onToggleFaq: (id: string | null) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="max-w-xl">
        <Input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search topics — refunds, seats, visas…"
          aria-label="Search help topics"
        />
      </div>

      {!categories.length ? (
        <p className="text-[13px] text-[var(--ink-soft)]">No topics match that search.</p>
      ) : (
        <div className="space-y-7">
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <section key={cat.id} className="fo-traveller__section">
                <div className="fo-traveller__section-head">
                  <h2 className="fo-traveller__section-title inline-flex items-center gap-2">
                    <span className="text-[var(--sky)]">
                      <Icon size={14} aria-hidden />
                    </span>
                    <span>{cat.title}</span>
                  </h2>
                </div>
                <p className="fo-traveller__section-note">{cat.desc}</p>
                <ul className="fo-traveller__list">
                  {cat.faqs.map((faq, idx) => {
                    const faqId = `${cat.id}-${idx}`;
                    const open = expandedFaq === faqId;
                    return (
                      <li key={faqId}>
                        <button
                          type="button"
                          aria-expanded={open}
                          onClick={() => onToggleFaq(open ? null : faqId)}
                          className="fo-traveller__row-link w-full text-left"
                        >
                          <div className="fo-traveller__row-top">
                            <p className="fo-traveller__row-title pr-3">{faq.q}</p>
                            <span
                              className={`shrink-0 text-[var(--ink-faint)] transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
                            >
                              <ChevronDown size={16} aria-hidden />
                            </span>
                          </div>
                          {open ? (
                            <p className="fo-traveller__row-body">{faq.a}</p>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
