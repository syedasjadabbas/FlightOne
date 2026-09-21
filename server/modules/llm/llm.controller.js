import { AppError } from "../../lib/customError.js";
import { successResponse } from "../../lib/response.js";
import * as llmService from "./llm.service.js";

function writeSse(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

/** GET /api/v1/llm/providers — configured provider names for diagnostics. */
export async function providers(_req, res, next) {
  try {
    return successResponse(res, "OK", {
      providers: llmService.configuredProviderNames(),
    });
  } catch (e) {
    next(e);
  }
}

/** POST /api/v1/llm/complete */
export async function complete(req, res, next) {
  try {
    const result = await llmService.complete(req.body);
    if (!result) {
      return next(
        new AppError(
          503,
          "No LLM provider available (LLM_PROVIDER=off or all providers failed)",
        ),
      );
    }
    return successResponse(res, "OK", {
      text: result.text,
      provider: result.provider,
      ...(result.finishReason != null
        ? { finishReason: result.finishReason }
        : {}),
      ...(result.thoughtsTokenCount != null
        ? { thoughtsTokenCount: result.thoughtsTokenCount }
        : {}),
    });
  } catch (e) {
    next(e);
  }
}

/** POST /api/v1/llm/complete/stream — SSE deltas then a done/error event. */
export async function completeStream(req, res, next) {
  try {
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    if (typeof res.flushHeaders === "function") res.flushHeaders();

    const gen = llmService.completeStream(req.body);
    let result = null;

    try {
      while (true) {
        const step = await gen.next();
        if (step.done) {
          result = step.value;
          break;
        }
        writeSse(res, { type: "delta", text: step.value });
      }

      if (!result) {
        writeSse(res, {
          type: "error",
          message:
            "No LLM provider available (LLM_PROVIDER=off or all providers failed)",
        });
      } else {
        writeSse(res, {
          type: "done",
          result: {
            text: result.text,
            provider: result.provider,
            ...(result.finishReason != null
              ? { finishReason: result.finishReason }
              : {}),
            ...(result.thoughtsTokenCount != null
              ? { thoughtsTokenCount: result.thoughtsTokenCount }
              : {}),
          },
        });
      }
    } catch (err) {
      writeSse(res, {
        type: "error",
        message: err?.message || "LLM stream failed",
      });
    }

    res.end();
  } catch (e) {
    // Headers may already be sent — avoid double-response via next().
    if (res.headersSent) {
      try {
        writeSse(res, {
          type: "error",
          message: e?.message || "LLM stream failed",
        });
        res.end();
      } catch {
        // ignore
      }
      return;
    }
    next(e);
  }
}
