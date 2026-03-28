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

/** Drop a final if it matches the previous final within this window (browser echo / segment overlap). */
const DUPLICATE_FINAL_WINDOW_MS = 1400;

function normalizeForDedupe(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.,!?;:]+$/g, "")
    .toLowerCase();
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
  const lastFinalAtRef = useRef<number>(0);

  const resetDedupe = useCallback(() => {
    lastFinalNormRef.current = null;
    lastFinalAtRef.current = 0;
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
    lastFinalNormRef.current = norm;
    lastFinalAtRef.current = now;
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
        const combined = finals.map((x) => x.trim()).filter(Boolean).join(" ");
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
