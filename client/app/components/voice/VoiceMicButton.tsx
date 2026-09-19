"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const sessionIdRef = useRef<string | null>(null);
  const recRef = useRef<SpeechRec | null>(null);

  const Ctor = getSpeechRecognitionCtor();
  const unsupported = !isBrowserVoiceSupported(
    Ctor,
    typeof navigator !== "undefined" ? navigator.mediaDevices : null,
  );
  const unauthenticated = hasHydrated && !accessToken;

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
  const label = status || voiceStatusLabel(uiState, { unsupported, unauthenticated });

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => (listening ? stopListening() : void startListening())}
        className={`flex h-8 w-8 items-center justify-center rounded-xl border transition-all ${
          listening
            ? "border-rose-300 bg-rose-50 text-rose-700"
            : "border-slate-200 bg-white text-slate-600 hover:border-cyan-300 hover:text-cyan-700"
        }`}
        aria-label={listening ? "Stop listening" : "Talk with Ava"}
        title={label}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
          />
        </svg>
      </button>
      {uiState !== "idle" ? (
        <p className="mt-1 max-w-[11rem] text-[10px] leading-snug text-slate-500" aria-live="polite">
          {label}
        </p>
      ) : null}
    </div>
  );
}
