import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { startCheckout, stashPendingCheckout, takePendingCheckout } from "./startCheckout";
import type { OfferCard } from "@/lib/consultant/types";

const offer = { id: "DEMO-1", type: "flight", priceMinor: 100 } as unknown as OfferCard;

describe("startCheckout", () => {
  afterEach(() => vi.unstubAllGlobals());

  const mockFetch = (status: number, body: unknown) =>
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
      }),
    );

  it("returns the booking id on success", async () => {
    mockFetch(200, { data: { id: "bk_1" } });
    await expect(startCheckout(offer, "t")).resolves.toEqual({ ok: true, bookingId: "bk_1" });
  });

  it("maps 409 to the re-price message rather than a generic error", async () => {
    mockFetch(409, {});
    const res = await startCheckout(offer, "t");
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.message).toMatch(/expired/i);
  });

  it("surfaces the server error text on other failures", async () => {
    mockFetch(400, { error: "Route not serviced" });
    const res = await startCheckout(offer, "t");
    expect(res.ok === false && res.message).toBe("Route not serviced");
  });

  it("fails cleanly when the response has no booking id", async () => {
    mockFetch(200, { data: {} });
    const res = await startCheckout(offer, "t");
    expect(res.ok).toBe(false);
  });

  it("does not throw when the network drops", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const res = await startCheckout(offer, "t");
    expect(res.ok).toBe(false);
  });
});

describe("pending checkout stash", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("round-trips an offer and clears it so a replay cannot re-fire", () => {
    stashPendingCheckout(offer);
    expect(takePendingCheckout()).toMatchObject({ id: "DEMO-1" });
    expect(takePendingCheckout()).toBeNull();
  });

  it("returns null rather than throwing on corrupt storage", () => {
    sessionStorage.setItem("flightone_pending_checkout_offer", "{not json");
    expect(takePendingCheckout()).toBeNull();
  });
});
