import { Scale } from "lucide-react";

export function VisaDisclaimer() {
  return (
    <aside className="fo-visa__notice" role="note">
      <span className="fo-visa__notice-icon" aria-hidden="true">
        <Scale size={16} />
      </span>
      <div>
        <p className="fo-visa__notice-title">Immigration rules change without notice</p>
        <p className="fo-visa__notice-copy">
          FlightOne attributes catalogued bilateral rules to your passport and vault
          documents. Confirm entry conditions with the consulate or official visa
          centre before you travel — this page is advisory, not a travel guarantee.
        </p>
      </div>
    </aside>
  );
}
