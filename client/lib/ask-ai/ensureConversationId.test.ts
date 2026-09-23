import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Guards the duplicate-conversation bug: one chat produced two sidebar
 * entries because two concurrent callers both saw a null id and both POSTed.
 *
 * Lives in its own file because it mocks the RTK store — the sibling
 * persistConversation.test.ts exercises the real parsing helpers.
 */

const dispatch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/store", () => ({ store: { dispatch } }));
vi.mock("@/lib/api/conversations.api", () => ({
  conversationsApi: { endpoints: { createConversation: { initiate: vi.fn(() => ({})) } } },
}));
vi.mock("@/lib/api/escalations.api", () => ({ escalationsApi: { endpoints: {} } }));

function mockCreate(id: string, delayMs = 5) {
  dispatch.mockReturnValue({
    unwrap: () => new Promise((r) => setTimeout(() => r({ id }), delayMs)),
  });
}

describe("ensureConversationId", () => {
  beforeEach(() => {
    vi.resetModules();
    dispatch.mockReset();
  });

  it("returns an existing id without creating anything", async () => {
    const { ensureConversationId } = await import("./persistConversation");
    await expect(ensureConversationId("conv_1")).resolves.toBe("conv_1");
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("collapses concurrent creates into ONE conversation", async () => {
    mockCreate("conv_new");
    const { ensureConversationId } = await import("./persistConversation");

    // The real bug: React StrictMode invoked the save twice in the same tick.
    const ids = await Promise.all([
      ensureConversationId(null, "trip"),
      ensureConversationId(null, "trip"),
      ensureConversationId(null, "trip"),
    ]);

    expect(ids).toEqual(["conv_new", "conv_new", "conv_new"]);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("allows a genuinely new conversation after the first settles", async () => {
    mockCreate("conv_a", 1);
    const { ensureConversationId } = await import("./persistConversation");
    await expect(ensureConversationId(null)).resolves.toBe("conv_a");

    mockCreate("conv_b", 1);
    await expect(ensureConversationId(null)).resolves.toBe("conv_b");
    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  it("does not latch a failure — a retry reaches the API again", async () => {
    dispatch.mockReturnValueOnce({ unwrap: () => Promise.reject(new Error("offline")) });
    const { ensureConversationId } = await import("./persistConversation");
    await expect(ensureConversationId(null)).resolves.toBeNull();

    mockCreate("conv_c", 1);
    await expect(ensureConversationId(null)).resolves.toBe("conv_c");
  });
});
