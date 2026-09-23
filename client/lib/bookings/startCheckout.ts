/**
 * Quote an offer and resolve where checkout should continue.
 *
 * Shared by the chat console and the post-login resume page so both take the
 * identical path — previously only chat could start a checkout, which forced
 * the login redirect to detour through /chat and flash the chat UI before
 * bouncing to the traveller details page.
 */
import type { OfferCard } from "@/lib/consultant/types";

export type StartCheckoutResult =
  | { ok: true; bookingId: string }
  | { ok: false; message: string };

const EXPIRED =
  "That fare's quote has expired. Run the search again and I'll re-price it.";

export async function startCheckout(
  offer: OfferCard,
  token: string,
  extra?: { companyId?: string },
): Promise<StartCheckoutResult> {
  try {
    const res = await fetch("/api/bookings/quote", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ ...offer, ...(extra?.companyId ? { companyId: extra.companyId } : {}) }),
    });

    const json = (await res.json().catch(() => null)) as
      | { data?: { id?: string }; error?: string }
      | null;

    if (!res.ok) {
      return {
        ok: false,
        message:
          res.status === 409
            ? EXPIRED
            : json?.error || "I couldn't start checkout for that fare. Please try again.",
      };
    }

    const bookingId = json?.data?.id;
    if (!bookingId) {
      return {
        ok: false,
        message: "Checkout didn't return a booking reference. Please try that fare again.",
      };
    }
    return { ok: true, bookingId };
  } catch {
    return {
      ok: false,
      message: "I lost the connection while starting checkout. Please try again.",
    };
  }
}

const PENDING_KEY = "flightone_pending_checkout_offer";

export function stashPendingCheckout(offer: OfferCard): void {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(offer));
  } catch {
    // Private-mode / quota failures must not block the login redirect.
  }
}

/** Reads and clears the stashed offer — a replayed offer must not re-fire. */
export function takePendingCheckout(): OfferCard | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PENDING_KEY);
    return JSON.parse(raw) as OfferCard;
  } catch {
    return null;
  }
}
