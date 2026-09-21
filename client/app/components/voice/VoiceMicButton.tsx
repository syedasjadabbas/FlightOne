"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, MicOff } from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import {
  useCreateVoiceSessionMutation,
  usePatchVoiceStateMutation,
  useVoiceTurnMutation,
} from "@/lib/api/voice.api";
import {
  isBrowserVoiceSupported,
  mapVoiceSessionState,
  sanitizeVoiceClientError,
  voiceStatusLabel,
  type VoiceUiState,
} from "@/lib/voice/voiceUi";

type SpeechRec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getSpeechRecognitionCtor(): (new () => SpeechRec) | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function VoiceMicButton({
  conversationId,
  onTranscript,
}: {
  conversationId: string | null;
  onTranscript: (text: string) => void;
}) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const [createSession] = useCreateVoiceSessionMutation();
  const [voiceTurn] = useVoiceTurnMutation();
  const [patchState] = usePatchVoiceStateMutation();

  const [uiState, setUiState] = useState<VoiceUiState>("idle");
  const [status, setStatus] = useState<string | null>(null);
  // Defer browser API checks until after mount so SSR HTML matches the first client paint.
  const [browserReady, setBrowserReady] = useState(false);
  const sessionIdRef = useRef<string | null>(null);
  const recRef = useRef<SpeechRec | null>(null);

  useEffect(() => {
    setBrowserReady(true);
  }, []);

  const Ctor = browserReady ? getSpeechRecognitionCtor() : null;
  const unsupported =
    browserReady &&
    !isBrowserVoiceSupported(
      Ctor,
      typeof navigator !== "undefined" ? navigator.mediaDevices : null,
    );
  const unauthenticated = browserReady && hasHydrated && !accessToken;

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    try {
      const u = new SpeechSynthesisUtterance(text.slice(0, 400));
      u.onend = () => setUiState((s) => (s === "speaking" ? "idle" : s));
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch {
      // browser TTS optional
    }
  }, []);

  const ensureSession = useCallback(async () => {
    if (sessionIdRef.current) return sessionIdRef.current;
    const created = await createSession(conversationId ? { conversationId } : {}).unwrap();
    sessionIdRef.current = created.id;
    return created.id;
  }, [conversationId, createSession]);

  const stopListening = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      // ignore
    }
  }, []);

  const startListening = useCallback(async () => {
    setStatus(null);
    if (unauthenticated) {
      setUiState("unavailable");
      setStatus(voiceStatusLabel("unavailable", { unauthenticated: true }));
      return;
    }
    if (unsupported) {
      setUiState("unavailable");
      setStatus(voiceStatusLabel("unavailable", { unsupported: true }));
      return;
    }
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setUiState("failed");
      setStatus(voiceStatusLabel("failed", { micDenied: true }));
      return;
    }

    try {
      const sessionId = await ensureSession();
      await patchState({ sessionId, state: "LISTENING" }).unwrap();
      setUiState("listening");

      const rec = new Ctor!();
      rec.lang = "en-US";
      rec.continuous = false;
      rec.interimResults = false;
      rec.onresult = (ev) => {
        const transcript = ev.results?.[0]?.[0]?.transcript?.trim();
        if (!transcript) return;
        void (async () => {
          setUiState("processing");
          try {
            await patchState({ sessionId, state: "PROCESSING" }).unwrap();
            const turn = await voiceTurn({
              sessionId,
              transcript,
              persistConversation: false,
            }).unwrap();
            onTranscript(transcript);
            if (turn.intent.kind === "BOOKING" && turn.intent.requiresConfirmation) {
              setUiState("confirmation_required");
            } else {
              setUiState(mapVoiceSessionState(turn.session.state));
            }
            setStatus(turn.reply);
            if (turn.reply) speak(turn.reply);
          } catch (err) {
            const msg = sanitizeVoiceClientError(
              err && typeof err === "object" && "data" in err
                ? (err as { data?: { message?: string } }).data?.message
                : null,
            );
            setUiState("failed");
            setStatus(msg);
          }
        })();
      };
      rec.onerror = (ev) => {
        if (ev.error === "not-allowed") {
          setUiState("failed");
          setStatus(voiceStatusLabel("failed", { micDenied: true }));
          return;
        }
        setUiState("failed");
        setStatus(sanitizeVoiceClientError(ev.error));
      };
      rec.onend = () => {
        setUiState((s) => (s === "listening" ? "idle" : s));
      };
      recRef.current = rec;
      rec.start();
    } catch (err) {
      setUiState("failed");
      setStatus(
        sanitizeVoiceClientError(
          err && typeof err === "object" && "data" in err
            ? (err as { data?: { message?: string } }).data?.message
            : "Voice is unavailable right now.",
        ),
      );
    }
  }, [Ctor, ensureSession, onTranscript, patchState, speak, unauthenticated, unsupported, voiceTurn]);

  useEffect(() => () => stopListening(), [stopListening]);

  const listening = uiState === "listening";
  const processing = uiState === "processing";
  const label = status || voiceStatusLabel(uiState, { unsupported, unauthenticated });

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => (listening ? stopListening() : void startListening())}
        className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--electric)]/35 ${
          listening
            ? "border-[color-mix(in_oklab,var(--danger)_35%,var(--line))] bg-[color-mix(in_oklab,var(--danger)_8%,white)] text-[var(--danger)]"
            : "border-[var(--line)] bg-white text-[var(--ink-soft)] hover:border-[color-mix(in_oklab,var(--electric)_40%,var(--line))] hover:text-[var(--electric)]"
        }`}
        aria-label={listening ? "Stop listening" : "Talk with Ava"}
        title={label}
      >
        {processing ? (
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden />
        ) : listening ? (
          <MicOff className="h-4 w-4" strokeWidth={1.9} aria-hidden />
        ) : (
          <Mic className="h-4 w-4" strokeWidth={1.9} aria-hidden />
        )}
      </button>
      {uiState !== "idle" ? (
        <p
          className="absolute bottom-full right-0 mb-1 max-w-[12rem] rounded-md border border-[var(--line)] bg-white px-2 py-1 text-[10px] leading-snug text-[var(--ink-soft)] shadow-[var(--shadow-soft)]"
          aria-live="polite"
        >
          {label}
        </p>
      ) : null}
    </div>
  );
}
