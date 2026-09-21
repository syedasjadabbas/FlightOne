"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { SUPPORT_TOPICS } from "./supportContent";

export function SupportTopicAccordion() {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div id="topics" className="fo-support__topics scroll-mt-24">
      <p className="fo-support__note">
        Start here. Open a case only when an answer is missing or a booking needs a human review.
      </p>

      {SUPPORT_TOPICS.map((topic) => {
        const Icon = topic.icon;
        return (
          <section key={topic.id} className="fo-traveller__section">
            <div className="fo-traveller__section-head">
              <h2 className="fo-traveller__section-title inline-flex items-center gap-2">
                <span className="fo-support__topic-icon">
                  <Icon size={14} strokeWidth={1.75} aria-hidden />
                </span>
                <span>{topic.title}</span>
              </h2>
            </div>
            <p className="fo-support__topic-desc">{topic.desc}</p>
            <ul className="m-0 list-none p-0">
              {topic.faqs.map((faq, idx) => {
                const faqId = `${topic.id}-${idx}`;
                const open = expanded === faqId;
                return (
                  <li key={faqId}>
                    <button
                      type="button"
                      className="fo-support__faq-btn"
                      aria-expanded={open}
                      onClick={() => setExpanded(open ? null : faqId)}
                    >
                      <span className="fo-support__faq-top">
                        <span className="fo-support__faq-q">{faq.q}</span>
                        <ChevronDown
                          className="fo-support__faq-chevron"
                          size={16}
                          strokeWidth={1.75}
                          aria-hidden
                        />
                      </span>
                      {open ? <p className="fo-support__faq-a">{faq.a}</p> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
