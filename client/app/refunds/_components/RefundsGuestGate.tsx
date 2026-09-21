import Link from "next/link";
import { Ban, FileCheck2, LogIn, MessageCircle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui";
import { TravellerPageHeader } from "@/app/components/traveller";

const PRINCIPLES = [
  {
    icon: FileCheck2,
    title: "Stored fare rules only",
    body: "Eligibility and amounts come from your booking’s stored fare and cancellation rules. Missing rules are marked unavailable — never guessed.",
  },
  {
    icon: Ban,
    title: "No false completion",
    body: "A refund is complete only after the payment provider or a documented void succeeds. Timeouts do not count as success.",
  },
  {
    icon: ShieldAlert,
    title: "Manual review when needed",
    body: "Ticketed supplier voids and unconfigured gateways go to the servicing desk. Staff tools stay behind permissions and 2FA.",
  },
] as const;

export function RefundsGuestGate() {
  return (
    <div className="fo-refunds">
      <TravellerPageHeader
        title="Refunds & servicing"
        lede="Refund amounts come only from stored fare rules and confirmed payment operations. Sign in to see bookings you own — this desk never invents payouts."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/login?redirect=%2Frefunds">
              <Button size="sm" icon={<LogIn size={14} strokeWidth={2} aria-hidden />}>
                Sign in
              </Button>
            </Link>
            <Link href="/chat">
              <Button size="sm" variant="secondary" icon={<MessageCircle size={14} strokeWidth={1.75} aria-hidden />}>
                Chat with Ava
              </Button>
            </Link>
          </div>
        }
      />

      <section className="fo-refunds__principles" aria-label="How refunds work">
        <ul className="fo-refunds__principle-list">
          {PRINCIPLES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="fo-refunds__principle">
              <span className="fo-refunds__principle-icon" aria-hidden>
                <Icon size={16} strokeWidth={1.75} />
              </span>
              <div className="min-w-0">
                <p className="fo-refunds__principle-title">{title}</p>
                <p className="fo-refunds__principle-body">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="fo-refunds__guest-cta">
        <p className="fo-refunds__guest-cta-title">Check your bookings</p>
        <p className="fo-refunds__guest-cta-body">
          After sign-in you can select a confirmed booking, review fare-rule eligibility, and submit a refund or cancellation request.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/login?redirect=%2Frefunds">
            <Button size="sm">Log in</Button>
          </Link>
          <Link href="/signup">
            <Button size="sm" variant="ghost">
              Create account
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
