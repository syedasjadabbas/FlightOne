import { runAskAi, runAskAiStream } from "@/lib/ask-ai/runAskAi";
import type { ChatTurn } from "@/lib/llm";
import { isTravellerLocation, type TravellerLocation } from "@/lib/geo/types";
import { askAiServiceErrorReply } from "@/lib/consultant/serviceMessages";

/**
 * Ask AI chat endpoint — KAYAK-style NL search + live results rail.
 * POST { message, history, location?, stream? } → JSON or SSE.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MESSAGE = 2000;
const MAX_HISTORY = 20;

function sanitizeHistory(input: unknown): ChatTurn[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter(
      (t): t is ChatTurn =>
        !!t &&
        typeof t === "object" &&
        (t as ChatTurn).role !== undefined &&
        ((t as ChatTurn).role === "user" || (t as ChatTurn).role === "assistant") &&
        typeof (t as ChatTurn).content === "string",
    )
    .slice(-MAX_HISTORY)
    .map((t) => ({ role: t.role, content: t.content.slice(0, MAX_MESSAGE) }));
}

function sanitizeLocation(input: unknown): TravellerLocation | null {
  if (!isTravellerLocation(input)) return null;
  return {
    city: input.city.trim().slice(0, 80),
    place: input.place.trim().slice(0, 80),
    country: input.country?.trim().slice(0, 80),
    countryCode: input.countryCode?.trim().slice(0, 2).toUpperCase(),
    region: input.region?.trim().slice(0, 80),
    iata: input.iata ? input.iata.trim().slice(0, 3).toUpperCase() : null,
    currency: input.currency.trim().slice(0, 3).toUpperCase(),
    source: input.source,
    latitude: typeof input.latitude === "number" ? input.latitude : undefined,
    longitude: typeof input.longitude === "number" ? input.longitude : undefined,
  };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const message = (body as { message?: unknown })?.message;
  if (typeof message !== "string" || message.trim().length === 0) {
    return Response.json({ error: "`message` is required" }, { status: 400 });
  }

  const history = sanitizeHistory((body as { history?: unknown })?.history);
  const location = sanitizeLocation((body as { location?: unknown })?.location);
  const stream = (body as { stream?: unknown })?.stream === true;
  const payload = {
    message: message.slice(0, MAX_MESSAGE),
    history,
    location,
  };

  if (!stream) {
    try {
      const result = await runAskAi(payload);
      return Response.json(result);
    } catch (err) {
      console.error("[/api/chat] error:", err);
      return Response.json(
        { error: askAiServiceErrorReply() },
        { status: 500 },
      );
    }
  }

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };
      try {
        for await (const event of runAskAiStream(payload)) {
          send(event);
        }
      } catch (err) {
        console.error("[/api/chat] stream error:", err);
        send({
          type: "error",
          message: askAiServiceErrorReply(),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
