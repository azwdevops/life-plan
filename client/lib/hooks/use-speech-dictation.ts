"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function getSpeechRecognitionCtor(): (new () => SpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() != null;
}

export type SpeechDictationHandlers = {
  onFinal: (text: string) => void;
  onInterim: (text: string) => void;
};

/** Min time after onend before starting a new segment (Chrome needs a gap; longer = less jarring). */
const RESTART_AFTER_END_MS = 720;

/** Same normalized phrase as the immediately previous final within this window → skip. */
const DUPLICATE_FINAL_WINDOW_MS = 5200;

/**
 * Same full phrase (normalized) must not be emitted again within this window,
 * even if other text was finalized in between (common after segment restarts).
 */
const SAME_PHRASE_COOLDOWN_MS = 6500;

function normalizeForDedupe(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.,!?;:]+$/g, "")
    .toLowerCase();
}

/** Collapse consecutive duplicate segments inside one `onresult` batch. */
function joinFinalsDeduped(parts: string[]): string {
  const trimmed = parts.map((x) => x.trim()).filter(Boolean);
  const out: string[] = [];
  for (const v of trimmed) {
    const n = normalizeForDedupe(v);
    if (!n) continue;
    if (out.length) {
      const prevN = normalizeForDedupe(out[out.length - 1]!);
      if (n === prevN) continue;
    }
    out.push(v);
  }
  return out.join(" ");
}

/**
 * Browser often re-finalizes only the tail of the last phrase after a segment restart.
 */
function isTrailingEchoOfLast(candidate: string, lastRaw: string): boolean {
  const c = candidate.trim().toLowerCase();
  const l = lastRaw.trim().toLowerCase();
  if (c.length < 2 || l.length < c.length) return false;
  if (c === l) return false;
  if (l.endsWith(c)) return true;
  if (l.endsWith(` ${c}`)) return true;
  const cw = c.split(/\s+/).filter(Boolean);
  const lw = l.split(/\s+/).filter(Boolean);
  if (cw.length === 0 || cw.length >= lw.length) return false;
  for (let i = 0; i < cw.length; i++) {
    if (lw[lw.length - cw.length + i] !== cw[i]) return false;
  }
  return true;
}

/** Segment restart may re-finalize the start of a phrase already in the last emission. */
function isPrefixEchoOfLast(candidate: string, lastRaw: string): boolean {
  const c = candidate.trim().toLowerCase();
  const l = lastRaw.trim().toLowerCase();
  if (c.length < 5 || c.length >= l.length) return false;
  if (l.startsWith(`${c} `) || l.startsWith(`${c},`)) return true;
  return false;
}

export function useSpeechDictation(handlers: SpeechDictationHandlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** True from user Start until user Stop — browser onend alone must not turn dictation off. */
  const sessionActiveRef = useRef(false);
  const lastFinalNormRef = useRef<string | null>(null);
  const lastFinalRawRef = useRef<string | null>(null);
  const lastFinalAtRef = useRef<number>(0);
  /** norm → last emit time; suppresses the same full phrase echoing soon after. */
  const phraseCooldownRef = useRef<Map<string, number>>(new Map());

  const resetDedupe = useCallback(() => {
    lastFinalNormRef.current = null;
    lastFinalRawRef.current = null;
    lastFinalAtRef.current = 0;
    phraseCooldownRef.current.clear();
  }, []);

  const clearRestartTimeout = useCallback(() => {
    if (restartTimeoutRef.current != null) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
  }, []);

  const emitFinalIfNotDuplicate = useCallback((raw: string) => {
    const t = raw.replace(/\s+/g, " ").trim();
    if (!t) return;
    const norm = normalizeForDedupe(t);
    if (!norm) return;
    const now = Date.now();

    if (
      lastFinalNormRef.current !== null &&
      norm === lastFinalNormRef.current &&
      now - lastFinalAtRef.current < DUPLICATE_FINAL_WINDOW_MS
    ) {
      return;
    }

    const lastRaw = lastFinalRawRef.current;
    if (lastRaw !== null && isTrailingEchoOfLast(t, lastRaw)) {
      return;
    }
    if (lastRaw !== null && isPrefixEchoOfLast(t, lastRaw)) {
      return;
    }

    const lastSamePhrase = phraseCooldownRef.current.get(norm) ?? 0;
    if (lastSamePhrase > 0 && now - lastSamePhrase < SAME_PHRASE_COOLDOWN_MS) {
      return;
    }

    if (phraseCooldownRef.current.size > 40) {
      for (const [k, at] of phraseCooldownRef.current) {
        if (now - at > 15000) phraseCooldownRef.current.delete(k);
      }
    }

    lastFinalNormRef.current = norm;
    lastFinalRawRef.current = t;
    lastFinalAtRef.current = now;
    phraseCooldownRef.current.set(norm, now);
    handlersRef.current.onFinal(t);
  }, []);

  const startOneSegment = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor || !sessionActiveRef.current) return;

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang =
      typeof navigator !== "undefined" && navigator.language
        ? navigator.language
        : "en-US";

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      const finals: string[] = [];
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) finals.push(r[0].transcript);
        else interim += r[0].transcript;
      }
      if (finals.length) {
        const combined = joinFinalsDeduped(finals);
        if (combined) emitFinalIfNotDuplicate(combined);
      }
      handlersRef.current.onInterim(interim.trim());
    };

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === "aborted") return;
      if (e.error === "not-allowed") {
        clearRestartTimeout();
        sessionActiveRef.current = false;
        setListening(false);
        handlersRef.current.onInterim("");
        resetDedupe();
        setError("Microphone permission denied. Allow the mic to use voice input.");
        return;
      }
      if (e.error === "no-speech") {
        return;
      }
      setError(e.message || e.error || "Speech recognition error.");
    };

    rec.onend = () => {
      recognitionRef.current = null;
      if (!sessionActiveRef.current) {
        setListening(false);
        handlersRef.current.onInterim("");
        return;
      }
      clearRestartTimeout();
      restartTimeoutRef.current = setTimeout(() => {
        restartTimeoutRef.current = null;
        if (sessionActiveRef.current) {
          startOneSegment();
        }
      }, RESTART_AFTER_END_MS);
    };

    recognitionRef.current = rec;
    try {
      rec.start();
    } catch {
      sessionActiveRef.current = false;
      setListening(false);
      handlersRef.current.onInterim("");
      resetDedupe();
      setError("Could not start the microphone.");
    }
  }, [clearRestartTimeout, emitFinalIfNotDuplicate, resetDedupe]);

  const stop = useCallback(() => {
    clearRestartTimeout();
    sessionActiveRef.current = false;
    resetDedupe();
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
  }, [clearRestartTimeout, resetDedupe]);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setError("Voice input is not supported in this browser.");
      return;
    }
    if (sessionActiveRef.current) return;
    setError(null);
    resetDedupe();
    sessionActiveRef.current = true;
    setListening(true);
    startOneSegment();
  }, [resetDedupe, startOneSegment]);

  useEffect(() => {
    return () => {
      clearRestartTimeout();
      sessionActiveRef.current = false;
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
    };
  }, [clearRestartTimeout]);

  const [supported, setSupported] = useState(false);
  useEffect(() => {
    setSupported(isSpeechRecognitionSupported());
  }, []);

  return {
    listening,
    error,
    start,
    stop,
    supported,
  };
}
